"""Capture a SALVO 1 win and loss on the archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
SHOT = 'WHERE DO YOU WISH TO FIRE YOUR MISSILE?'
RUNS = [
    ('win with a miss and two computer hits', 0, ['10,15,20,25', '1', '6', '7', '10', '20'],
     ['HA,HA YOU MISSED', 'ONE DOWN THREE TO GO', 'TWO DOWN TWO TO GO',
      'THREE DOWN ONE TO GO', 'POST 15 WAS HIT.', 'POST 20 WAS HIT.', 'YOU GOT ME']),
    ('fresh run and loss after four computer hits', 17, ['2,14,16,10', '25', '24', '23', '22'],
     ['POST 2 WAS HIT.', 'POST 14 WAS HIT.', 'POST 16 WAS HIT.',
      "YOU'RE DEAD.  YOUR LAST OUTPOST WAS AT 10 ", 'BETTER LUCK NEXT TIME.']),
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
    prefix = console.before.replace(TAPE_FLUSH, '')
    assert prefix.endswith('\r\n'), repr(prefix)
    chunks = [prefix.removesuffix('\r\n')]
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {clock_word:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    for index, answer in enumerate(answers):
        prompt = 'WHAT ARE YOUR FOUR POSITIONS?' if index == 0 else SHOT
        console.expect_exact(['READY', prompt])
        assert console.after == prompt, repr(console.before + console.after)
        chunks.append(console.before + prompt)
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
    fixtures = directory.parent / 'package/fixtures/classic'
    pinned_source = (fixtures / 'salvo1.bas').read_bytes()
    source = (fixtures / 'salvo1-edusystem30.bas').read_bytes()
    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, answers, checks in RUNS:
            output = capture_run(console, shared, clock_word, answers)
            assert output.count(SHOT) == len(answers) - 1, repr(output)
            assert all(check in output for check in checks), repr(output)
            runs.append({'name': name, 'clockWord': clock_word, 'answers': answers, 'output': output})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'pinnedSha256': shared['digest'](pinned_source),
        'fixtureSha256': shared['digest'](source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
