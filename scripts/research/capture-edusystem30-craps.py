"""Capture CRAPS' MARK adaptation, replay and fresh RUN on archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
GUESS = 'HOW MUCH DO YOU BET?'
REPLAY = 'ARE YOU READY (Y OR N)? '
RUNS = [
    ('instruction repeat, wager retries, both shooters, and voluntary exit', 0,
     ['N', 'Y', '.5', '999', '10', '10', '10', '10', '10', '0'],
     ['NO COINS PERMITTED', "DON'T TRY TO BET MORE", 'SO YOUR POINT IS 8',
      'AND LOSE...', 'CHANGE DICE NOW...', 'AND PASS....', 'AND MAKE MY POINT',
      'AND MAKE YOUR POINT', 'THANKS FOR THE GAME.']),
    ('fresh run with new entropy, point win and bankruptcy', 17, ['Y', '50', '100'],
     ['YOU ARE GIVEN  50 DOLLARS', 'AND MAKE YOUR POINT', 'YOU NOW HAVE  100 DOLLARS',
      'AND LOSE...', 'YOU HAVE RUN OUT OF MONEY']),
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
    assert tail.endswith('\x00\r\n'), repr(tail)
    chunks.append(tail.removesuffix('\x00\r\n'))
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
    fixture = directory.parent / 'package/fixtures/classic/craps-mark-adapted.bas'
    source = fixture.read_bytes()
    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, answers, checks in RUNS:
            output = capture_run(console, shared, clock_word, answers)
            assert output.startswith('\n' * 10 + 'THIS DEMONSTRATION'), repr(output)
            assert all(check in output for check in checks), repr(output)
            runs.append({'name': name, 'clockWord': clock_word, 'answers': answers, 'output': output})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': shared['digest'](source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
