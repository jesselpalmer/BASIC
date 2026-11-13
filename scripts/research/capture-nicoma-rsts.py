"""Replay the March 1975 NICOMA sample on the archived V4B-17 RK05 image."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
import time

import pexpect


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts/package/fixtures/classic/nicoma-mar75-text.bas'
REFERENCE = ROOT / 'docs/nicoma-rsts-reference.json'
SOURCE_SHA256 = '0d92549b3d7adcbfef3c2ce797574f4efe8c17246e6588610b3d3f4a6c2f44e8'
DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
SIMULATOR = '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6'
BUILD = 'RSTS V04B-17 RSTSV4B'
THINK = 'LET ME THINK A MOMENT....\r\n'
ROUNDS = [
    (('3', '0', '5'), 75, ('RIGHT', 'YES')),
    (('2', '4', '6'), 104, ('YES',)),
    (('1', '1', '1'), 1, ('NO',)),
    (('0', '0', '1'), 15, ('YES',)),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def boot(console):
    console.expect_exact(f'simh git commit id: {SIMULATOR[:8]}')
    console.expect_exact(BUILD)
    for prompt, answer in [
        ('OPTION? ', 'START'),
        ('DD-MON-YY? ', '12-DEC-72'),
        ('HH:MM? ', '12:34'),
        ('ENABLE CRASH DUMP? ', 'N'),
    ]:
        console.expect_exact(prompt)
        console.send(answer + '\r')
    console.expect_exact('END OF FILE ON DEVICE - INIT ASSUMED COMPLETE')
    console.expect_exact('Ready')


def enter(console, line):
    console.send(line + '\r')
    console.expect_exact(line + '\r\n')


def enter_program(console, source):
    enter(console, 'NEW NICOMA')
    console.expect_exact('Ready')
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact('Ready')
    listing = re.findall(r'^([?]?\d+ .*)\r$', console.before, re.M)
    assert listing == source, listing


def play(console):
    enter(console, 'RUN')
    console.expect(r'NICOMA +[^\r\n]*\r\n')
    transcript = []
    pause_seconds = []

    def read_through(text):
        console.expect_exact(text)
        transcript.append(console.before + console.after)

    def answer(text):
        console.send(text + '\r')
        read_through(text + '\r\n')

    for remainders, guess, responses in ROUNDS:
        for divisor, remainder in zip((3, 5, 7), remainders):
            read_through(f'YOUR NUMBER DIVIDED BY {divisor} HAS A REMAINDER OF? ')
            answer(remainder)
        read_through(THINK)
        started = time.monotonic()
        prompt = f'YOUR NUMBER WAS {guess} , RIGHT? '
        read_through(prompt)
        pause_seconds.append(time.monotonic() - started)
        for response in responses[:-1]:
            answer(response)
            read_through(prompt)
        answer(responses[-1])

    read_through('YOUR NUMBER DIVIDED BY 3 HAS A REMAINDER OF? ')
    console.sendcontrol('c')
    read_through('Ready\r\n')
    return ''.join(transcript).replace('\r\n', '\n'), pause_seconds



def probe_input_columns(console):
    captures = []
    for statement, reply in [('INPUT A', '7'), ('INPUT A$', 'YES')]:
        enter(console, 'NEW CURSOR')
        console.expect_exact('Ready')
        for line in [
            '10 PRINT "PREFIX";',
            f'20 {statement}',
            '30 PRINT TAB(4);"TAIL"',
            '40 END',
        ]:
            enter(console, line)
        enter(console, 'RUN')
        console.expect_exact('PREFIX? ')
        console.send(reply + '\r')
        console.expect_exact('Ready')
        assert console.before == reply + '\r\n    TAIL\r\n\r\n'
        captures.append({
            'statement': statement,
            'reply': reply,
            'outputAfterReply': '    TAIL\n',
        })
    return captures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--disk', type=Path, required=True)
    parser.add_argument('--record', action='store_true')
    args = parser.parse_args()
    disk = args.disk.resolve()
    simulator = args.simulator.resolve()
    source = SOURCE.read_bytes()
    assert digest(source) == SOURCE_SHA256
    assert digest(disk.read_bytes()) == DISK_SHA256

    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(
            'set cpu 11/05\nset cpu 64k\nset clk 60hz\n'
            'set hk disabled\nset ptr disabled\nset ptp disabled\nset dz disabled\n'
            'set rl disabled\nset rx disabled\nset rp disabled\nset rq disabled\n'
            'set ts disabled\nset tq disabled\nset rk enabled\nset tm enabled\n'
            'attach rk0 working.dsk\nboot rk0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(simulator), ['boot.ini'], cwd=directory, encoding='ascii', timeout=15
        ) as console:
            boot(console)
            enter_program(console, source.decode('ascii').splitlines())
            transcript, pause_seconds = play(console)
            cursor_probes = probe_input_columns(console)

    observed = {
        'sourceSha256': SOURCE_SHA256,
        'transcript': transcript.split('\n'),
        'inputCursor': cursor_probes,
    }
    if args.record:
        REFERENCE.write_text(json.dumps(observed, indent=2) + '\n', encoding='ascii')
    else:
        reference = json.loads(REFERENCE.read_text(encoding='ascii'))
        assert observed == reference, repr(observed)
    print('Observed pause seconds:', ', '.join(f'{duration:.2f}' for duration in pause_seconds))
    print(f'Verified NICOMA on {BUILD}')


if __name__ == '__main__':
    main()
