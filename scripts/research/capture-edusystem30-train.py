"""Capture TRAIN's MARK adaptation, replay and fresh RUN on archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
GUESS = 'HOW LONG DOES THE TRIP TAKE BY CAR?'
REPLAY = 'ANOTHER PROBLEM (Y OR N)? '
RUNS = [
    ('correct answer, replay, six-percent miss and quit', 0, ['12.3', 'Y', '16.7', 'N'],
     ['12.3158', '17.7143'], ['GOOD!  ANSWER WITHIN 0 PERCENT.', 'SORRY.  YOU WERE OFF BY 6 PERCENT.']),
    ('fresh run with a different clock word', 0o21, ['16.5', 'N'], ['16.5'],
     ['GOOD!  ANSWER WITHIN 0 PERCENT.']),
]


def capture_run(console, shared, clock_word, answers):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 02755')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('Breakpoint, PC: 02755')
    # The SIMH breakpoint starts on a new line, even if the terminal is mid-print.
    prefix = console.before.replace(TAPE_FLUSH, '')
    assert prefix.endswith('\r\n'), repr(prefix)
    chunks = [prefix.removesuffix('\r\n')]
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {clock_word:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    for answer in answers:
        character = answer in ('Y', 'N')
        prompt = REPLAY if character else GUESS
        console.expect_exact([GUESS, REPLAY])
        assert console.after == prompt, repr(console.before + console.after)
        chunks.append(console.before + prompt)
        if character:
            console.send(answer)
            console.expect_exact(answer)
            assert console.before == '', repr(console.before)
        else:
            shared['send_line'](console, answer)
    console.expect_exact('READY')
    tail = console.before
    assert tail == '\r\n\x00\r\n', repr(tail)
    chunks.append('\r\n')
    return ''.join(chunks).replace(TAPE_FLUSH, '').replace('\r\n', '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixture = directory.parent / 'package/fixtures/classic/train-mark-adapted.bas'
    source = fixture.read_bytes()
    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, answers, hours, grades in RUNS:
            output = capture_run(console, shared, clock_word, answers)
            assert output.startswith('TIME - SPEED - DISTANCE EXERCISE\n\n'), repr(output)
            assert output.count(REPLAY) == len(hours), repr(output)
            for value, grade in zip(hours, grades, strict=True):
                assert f'{grade} \nCORRECT ANSWER IS {value} HOURS. \n' in output, repr(output)
            runs.append({'name': name, 'clockWord': clock_word, 'answers': answers, 'output': output})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': shared['digest'](source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
