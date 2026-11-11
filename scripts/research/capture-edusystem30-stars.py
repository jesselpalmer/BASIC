"""Reproduce the reviewed STARS listing on archived EDU30.SV in SIMH."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '1121376962a0ffb59fe1a70c10174e195ef70a391781c70ebe4663930ce503cf'
CLOCK_WORD = 0
INSTRUCTIONS = 'DO YOU WANT INSTRUCTIONS (1=YES 0=NO)?'
GUESS = 'YOUR GUESS?'
ROUNDS = [
    (['1', '100', '55', '7', '31', '19', '25', '22', '27'], list(range(1, 8)), 23),
    (['0', '23'], [], None),
]


def capture_round(console, shared, answers, star_counts, losing_number):
    send_line = shared['send_line']
    normalize = shared['normalize']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('\r\nBreakpoint, PC: 02755')
    chunks = [console.before]
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {CLOCK_WORD:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    for index, answer in enumerate(answers):
        prompt = INSTRUCTIONS if index == 0 else GUESS
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        send_line(console, answer)
    console.expect_exact(GUESS)
    chunks.append(console.before + GUESS)
    console.sendcontrol('c')
    console.expect_exact('READY')

    output = normalize(''.join(chunks).replace('DT0: writing buffer to file: working.tu56\r\n', ''))
    assert output.startswith('STARS - A NUMBER GUESSING GAME\n'), repr(output)
    clues = [len(clue) for clue in re.findall(r'(?<=\?)\*+(?=\n)', output)]
    assert clues == star_counts, repr(output)
    losses = re.findall(r"SORRY, THAT'S 7 GUESSES\. NUMBER WAS (\d+) ", output)
    assert losses == ([str(losing_number)] if losing_number is not None else []), repr(output)
    assert output.count('*' * 50 + '!!!\n') == 1, repr(output)
    assert output.count("YOU GOT IT IN  1 GUESSES!!  LET'S PLAY AGAIN...") == 1, repr(output)
    assert output.count('I AM THINKING OF A WHOLE NUMBER FROM 1 TO') == (answers[0] == '1')
    return {
        'answers': answers,
        'starCounts': star_counts,
        'outputSha256': shared['digest'](output.encode('ascii')),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    root = Path(__file__).resolve().parents[2]
    fixture = (root / 'scripts/package/fixtures/classic/stars-mar75-text.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            shared['send_line'](console, line)
        console.sendcontrol('e')
        console.expect_exact('sim> ')
        console.sendline('break 02755')
        console.expect_exact('sim> ')
        console.sendline('continue')
        console.expect_exact('continue\r\n')
        rounds = [capture_round(console, shared, *round_) for round_ in ROUNDS]

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'clockWord': CLOCK_WORD,
        'rounds': rounds,
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
