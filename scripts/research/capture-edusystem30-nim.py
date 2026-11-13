"""Replay the reviewed NIM adaptation on stock EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
BANNER = 'EDUSYSTEM-30\r\n\r\n'
RUNS = [
    ('input retries, computer win, and same-arrangement player win', 0,
     ['N', '0', '1', '21', '3', 'Y', '2', '1', '0', '1', 'Y', 'Y', 'Y', '1', '3', 'N'],
     ['ILLEGAL PILE NUMBER.', 'ILLEGAL STICK NUMBER.', "I'LL TAKE 2 STICKS FROM PILE 1 .",
      'I WON.', 'SAME ARRANGEMENT?', 'YOU WON.']),
    ('fresh two-pile loss with the computer moving first', 17,
     ['Y', '2', '1', '2', 'N', '1', '1', 'N'],
     ['THE PLAYER WHO TAKES THE LAST STICK', "I'LL TAKE 1 STICK FROM PILE 2 .",
      'PILE NUMBER   STICKS LEFT', 'I WON.']),
]


def play(console, shared, clock_word, answers):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 02755')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    first_prompt = 'DO YOU WANT INSTRUCTIONS?'
    console.expect_exact(first_prompt)
    chunks = [console.before + first_prompt]
    console.send(answers[0])
    console.expect_exact(answers[0])
    assert not console.before, repr(console.before)
    console.expect_exact('Breakpoint, PC: 02755')
    opening = console.before.replace(TAPE_FLUSH, '')
    assert opening.endswith('\r\n'), repr(opening)
    chunks.append(opening.removesuffix('\r\n'))
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {clock_word:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    for answer in answers[1:]:
        console.expect_exact(['?', 'READY'])
        assert console.after == '?', repr(console.before)
        chunks.append(console.before + '?')
        if answer in ('Y', 'N'):
            console.send(answer)
            console.expect_exact(answer)
            assert not console.before, repr(console.before)
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
    digest = shared['digest']
    assert digest(tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = directory.parent / 'package/fixtures/classic'
    pinned = (fixtures / 'nim.bas').read_bytes()
    source = (fixtures / 'nim-edusystem30.bas').read_bytes()
    assert digest(pinned) == '3531bb430a0e0f28cd8421d0d1fd54f94589a191804b6a74d37c1f914ee46298'

    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = .01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, answers, checks in RUNS:
            output = play(console, shared, clock_word, answers)
            assert output.count('?') == len(answers), repr(output)
            assert all(text in output for text in checks), repr(output)
            runs.append({'name': name, 'clockWord': clock_word, 'answers': answers, 'output': output})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'pinnedSha256': digest(pinned),
        'fixtureSha256': digest(source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
