"""Verify the FIPFOP source boundary and two solved rounds on archived BASIC-PLUS."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
RAW_SHA256 = 'ce41c81c5db270e429a891d8b0883b63bf1af3838f0911518ab7669a5b619f1e'
REVIEWED_SHA256 = '82a1551be2be4d6f65d74c24c320f3f634d58f8f3df6e53e4e8617d7f0fb6535'
NUMBER = 'INPUT THE NUMBER? '
REPLAY = 'DO YOU WANT TO DO ANOTHER PUZZLE? '
READY = 'Ready\r\n'
HEADING = 'HERE IS THE STARTING LINE OF X\'S:'
BOARD = '1 2 3 4 5 6 7 8 9 10\r\n'
WIN = 'VERY GOOD. YOU GUESSED IT IN ONLY  8 GUESSES!!!!'
SOLUTION = ['1', '2', '2', '4', '5', '7', '8', '10']
BOARDS = ['OXXXXXXXXX', 'OOXXXXXXOX', 'OXXXXOXXOX', 'OOXOXOXXOX',
          'OOOOOOXXOX', 'OOOOOXOXOX', 'OOOOOOOOOX', 'OOOOOOOOOO']
BOOT = (
    'set cpu 11/05\nset cpu 64k\nset clk 60hz\n'
    'set hk disabled\nset ptr disabled\nset ptp disabled\nset dz disabled\n'
    'set rl disabled\nset rx disabled\nset rp disabled\nset rq disabled\n'
    'set ts disabled\nset tq disabled\nset rk enabled\nset tm enabled\n'
    'attach rk0 working.dsk\nboot rk0\n'
)


def enter(console, line):
    console.send(line + '\r')
    wrapped = '\r\n'.join(line[i:i+72] for i in range(0, len(line), 72))
    console.expect_exact(wrapped + '\r\n')


def load(console, shared, lines, rejected=None):
    shared['boot'](console)
    enter(console, 'NEW FIPFOP')
    console.expect_exact(READY)
    errors = []
    for line in lines:
        enter(console, line)
        errors.extend(
            match.group(0)
            for text in console.before.splitlines()
            if (match := re.fullmatch(r'.*ERROR at line \d+ *', text))
        )
    enter(console, 'LIST')
    console.expect_exact(READY)
    start = re.search(r'FIPFOP +[^\r\n]*\r\n', console.before)
    assert start
    listing = console.before[start.end():]
    for line in lines:
        if rejected and line.startswith(f'{rejected} '):
            line = '?' + line
        wrapped = '\r\n'.join(line[i:i+72] for i in range(0, len(line), 72))
        assert listing.startswith(wrapped + '\r\n'), repr(listing)
        listing = listing[len(wrapped) + 2:]
    assert not listing.strip(), repr(listing)
    assert errors == (['MODIFIER ERROR at line 530 '] if rejected else []), errors
    enter(console, 'RUN')
    console.expect(r'FIPFOP +[^\r\n]*\r\n')


def respond(console, answer, prompt):
    console.send(answer + '\r')
    console.expect_exact(answer + '\r\n')
    console.expect_exact(prompt)
    return console.before


def original(console, shared, lines):
    load(console, shared, lines, rejected=530)
    console.expect_exact(NUMBER)
    assert 'BY TYPING IN THE NUMBER' in console.before
    assert BOARD + 'X X X X X X X X X X\r\n' in console.before
    assert respond(console, '12', NUMBER) == 'ILLEGAL ENTRY--TRY AGAIN\r\n'
    reset = respond(console, '0', NUMBER)
    assert reset == BOARD + 'X X X X X X X X X X\r\n\r\n', repr(reset)
    restart = respond(console, '11', NUMBER)
    assert restart == HEADING + '\r\n\r\n' + reset, repr(restart)
    opening = respond(console, '1', NUMBER)
    assert re.fullmatch(re.escape(BOARD) + r'O (?:[OX] ){9}\r\n', opening), repr(opening)
    error = respond(console, '1', READY)
    assert error == 'ILLEGAL STATEMENT at line 530 \r\n\r\n', repr(error)
    return {
        'entryDiagnostic': 'MODIFIER ERROR at line 530',
        'inputs': ['12', '0', '11', '1', '1'],
        'observations': [
            'out-of-range entry retries', '0 resets the board', '11 starts a new puzzle',
            'first position flips', error.strip(),
        ],
    }


def solved(console, shared, lines):
    load(console, shared, lines)
    console.expect_exact(NUMBER)
    transcript = [console.before + NUMBER]
    for index, answer in enumerate([*SOLUTION, 'YES', *SOLUTION, 'NO']):
        if answer == 'YES':
            prompt = NUMBER
        elif answer == 'NO':
            prompt = READY
        else:
            prompt = REPLAY if index in (7, 16) else NUMBER
        output = respond(console, answer, prompt)
        transcript.append(output + prompt)
        if answer in SOLUTION:
            row = BOARDS[index % 9]
            expected = BOARD + ' '.join(row) + ' \r\n'
            if prompt == REPLAY:
                expected += WIN + '\r\n'
            assert output == expected, repr(output)
        elif answer == 'YES':
            assert HEADING in output and BOARD + 'X X X X X X X X X X\r\n' in output
        else:
            assert output == '\r\n', repr(output)
    return {
        'inputs': [*SOLUTION, 'YES', *SOLUTION, 'NO'],
        'boardsPerRound': BOARDS,
        'outputSha256': shared['digest'](''.join(transcript).replace('\r\n', '\n').encode('ascii')),
    }


def edu30_rejection(simulator, tape, lines):
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    with shared['edu30'](simulator, tape) as console:
        for line in lines:
            shared['send_line'](console, line)
        shared['send_line'](console, 'RUN')
        console.expect_exact('READY')
        output = shared['normalize'](console.before)
    diagnostics = output.split('EDUSYSTEM-30\n\n', 1)[1].strip().splitlines()
    expected = [100, 120, 140, 160, 260, 280, 400, 410, 450, 460,
                480, 510, 520, 530, 560, 570, 590, 620, 660, 740]
    assert diagnostics == [f'S1 {label}' for label in expected], diagnostics
    return {'tapeSha256': shared['TAPE_SHA256'], 'diagnostics': diagnostics}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--disk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--edu30-simulator', type=Path, required=True)
    parser.add_argument('--edu30-tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-nicoma-rsts.py')))
    digest = shared['digest']
    simulator, disk = args.simulator.resolve(), args.disk.resolve()
    assert digest(disk.read_bytes()) == shared['DISK_SHA256']
    raw = (FIXTURES / 'fipfop.bas').read_bytes()
    reviewed = (FIXTURES / 'fipfop-mar75-text.bas').read_bytes()
    probe = (FIXTURES / 'fipfop-v4b-probe.bas').read_bytes()
    assert digest(raw) == RAW_SHA256 and digest(reviewed) == REVIEWED_SHA256
    assert probe == reviewed.replace(b'190 LET Q=RND(Y)', b'190 LET Q=.125').replace(
        b'COT(Q/N+Q)', b'(1/TAN(Q/N+Q))',
    )

    def capture(run, source):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(BOOT, encoding='ascii')
            with pexpect.spawn(
                str(simulator), ['boot.ini'], cwd=directory, encoding='ascii', timeout=15
            ) as console:
                return run(console, shared, source.decode('ascii').splitlines())

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'diskSha256': shared['DISK_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'reviewedFixtureSha256': REVIEWED_SHA256,
        'probeFixtureSha256': digest(probe),
        'printedListing': capture(original, reviewed),
        'fixedQProbe': capture(solved, probe),
        'edu30': edu30_rejection(
            args.edu30_simulator.resolve(), args.edu30_tape.resolve(),
            reviewed.decode('ascii').splitlines(),
        ),
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
