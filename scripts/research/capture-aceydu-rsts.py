"""Verify ACEYDU on archived RSTS/E V04B-17 and replay its default random stream."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'scripts/package/fixtures/classic'
REFERENCE = ROOT / 'docs/aceydu-rsts-reference.json'
RAW_SHA256 = '686b00f4ca413243877764e9bec6d3318831884bfa8bc8ffab07749b6e1142c4'
REVIEWED_SHA256 = '4fe731f92c62c0a28f871459780ec859ee586883d9afb97ca62a6f443deb0dda'
BET = 'WHAT IS YOUR BET? '
REPLAY = 'TRY AGAIN (YES OR NO)? '
READY = 'Ready\r\n'
BANKRUPT = 'SORRY, FRIEND, BUT YOU BLEW YOUR WAD. \r\n'
FAREWELL = '\r\nO. K. HOPE YOU HAD FUN!!\r\n\r\n'
BANKROLL = re.compile(r'YOU NOW HAVE (\d+) DOLLARS\. \r\n')
DEFAULT_INPUTS = ['101', '0', '10', '20', '70', '140', 'YES', '100', 'NO']


def load(console, boot, enter, lines):
    boot(console)
    enter(console, 'NEW ACEYDU')
    console.expect_exact(READY)
    for line in lines:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(READY)
    start = re.search(r'ACEYDU +[^\r\n]*\r\n', console.before)
    assert start
    assert console.before[start.end():].strip('\r\n').split('\r\n') == lines


def start(console, enter):
    enter(console, 'RUN')
    console.expect(r'ACEYDU +[^\r\n]*\r\n')
    console.expect_exact(BET)
    opening = console.before
    assert BANKROLL.search(opening).group(1) == '100'
    return opening


def respond(console, answer):
    console.send(answer + '\r')
    console.expect_exact(answer + '\r\n')
    console.expect_exact([BET, REPLAY, READY])
    return console.before, console.after


def play_reviewed(console, enter):
    start(console, enter)
    output, prompt = respond(console, '101')
    assert prompt == BET and 'YOU HAVE ONLY 100 DOLLARS TO BET.' in output
    output, prompt = respond(console, '0')
    assert prompt == BET and output.startswith('CHICKEN!!\r\n')

    for replay in ('YES', 'NO'):
        bankroll = 100
        for _ in range(20):
            output, prompt = respond(console, str(bankroll))
            if prompt == REPLAY:
                assert output.endswith(BANKRUPT)
                break
            assert prompt == BET and 'YOU WIN!!!' in output
            bankroll *= 2
            assert int(BANKROLL.search(output).group(1)) == bankroll
        else:
            raise AssertionError('Expected bankruptcy within 20 all-in bets')
        output, prompt = respond(console, replay)
        if replay == 'YES':
            assert prompt == BET and BANKROLL.search(output).group(1) == '100'
        else:
            assert prompt == READY and output == FAREWELL


def play_default(console, enter):
    opening = start(console, enter)
    assert opening.endswith(' 3 \r\n 4 \r\n\r\n')
    transcript = [opening + BET]
    for answer in DEFAULT_INPUTS:
        output, prompt = respond(console, answer)
        if answer == 'NO':
            assert prompt == READY and output == FAREWELL
        transcript.append(output + (prompt if prompt != READY else ''))
    return ''.join(transcript).replace('\r\n', '\n')


def capture_rng(console, enter):
    def run():
        enter(console, 'RUN')
        console.expect(r'ACEYDU +[^\r\n]*\r\n')
        console.expect_exact(READY)
        return console.before.replace('\r\n', '\n')

    bare = run()
    assert run() == bare
    enter(console, '20 A=RND(I-2)*32768')
    assert run() == bare
    enter(console, '20 A=RND(1/(I-1))*32768')
    assert run() == 'DIVISION BY 0 at line 20 \n' + bare
    values = []
    for line in bare.splitlines():
        if line:
            high, low = map(int, line.split())
            assert low == 0, (high, low)
            values.append(high)
    assert len(values) == 12, values
    return {
        'scaledDefaultValues': values,
        'scale': 32768,
        'identicalOnFreshRun': True,
        'identicalWithArgumentsFromMinusOneThroughTen': True,
        'divisionByZeroArgumentDiagnostic': 'DIVISION BY 0 at line 20',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--disk', type=Path, required=True)
    parser.add_argument('--record', action='store_true')
    args = parser.parse_args()

    shared = runpy.run_path(str(Path(__file__).with_name('capture-nicoma-rsts.py')))
    fipfop = runpy.run_path(str(Path(__file__).with_name('capture-fipfop-rsts.py')))
    digest = shared['digest']
    simulator, disk = args.simulator.resolve(), args.disk.resolve()
    assert digest(disk.read_bytes()) == shared['DISK_SHA256']
    raw = (FIXTURES / 'aceydu.bas').read_bytes()
    reviewed = (FIXTURES / 'aceydu-mar75-text.bas').read_bytes()
    assert digest(raw) == RAW_SHA256 and digest(reviewed) == REVIEWED_SHA256
    probe = reviewed.replace(b'100 RANDOMIZE\n', b'')
    assert len(probe.splitlines()) == len(reviewed.splitlines()) - 1

    def capture(play, source):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(fipfop['BOOT'], encoding='ascii')
            with pexpect.spawn(
                str(simulator), ['boot.ini'], cwd=directory, encoding='ascii', timeout=15
            ) as console:
                load(console, shared['boot'], fipfop['enter'], source.decode('ascii').splitlines())
                return play(console, fipfop['enter'])

    capture(play_reviewed, reviewed)
    transcript = capture(play_default, probe)
    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'diskSha256': shared['DISK_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'reviewedFixtureSha256': REVIEWED_SHA256,
        'rngProbe': capture(capture_rng, (
            b'10 FOR I=1 TO 12\n'
            b'20 A=RND*32768\n'
            b'25 PRINT INT(A);INT(32768*(A-INT(A)))\n'
            b'30 NEXT I\n'
            b'40 END\n'
        )),
        'defaultStream': {
            'removedLine': '100 RANDOMIZE',
            'sourceSha256': digest(probe),
            'inputs': DEFAULT_INPUTS,
            'output': transcript,
        },
    }
    if args.record:
        REFERENCE.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')
    else:
        assert evidence == json.loads(REFERENCE.read_text(encoding='ascii')), evidence
    print(f'Verified reviewed ACEYDU and its default-stream replay on {shared["BUILD"]}')


if __name__ == '__main__':
    main()
