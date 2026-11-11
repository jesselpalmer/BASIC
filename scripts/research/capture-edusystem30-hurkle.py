"""Reproduce the reviewed HURKLE listing on archived EDU30.SV in SIMH."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '7616322434de68eed19ea83980a63dd0c365a693d91eb4a09bc1abea5eb643e0'
CLOCK_WORD = 4
ROUNDS = [
    (
        ['5,5', '7,7', '8,7', '4,9', '6,9', '6,8', '5,9', '5,7', '8,3'],
        ['NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTHWEST', 'WEST', 'SOUTH', 'NORTH'],
        [3, 1],
        [(5, 8)],
    ),
    (['8,7'], [], [1], []),
]


def capture_round(console, shared, answers, hints, win_counts, losses):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('\r\nBreakpoint, PC: 02755')
    chunks = [console.before]
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {CLOCK_WORD:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('GUESS # 1 ?')
    chunks.append(console.before + 'GUESS # 1 ?')
    console.sendcontrol('c')
    console.expect_exact('READY')

    output = shared['normalize'](
        ''.join(chunks).replace('DT0: writing buffer to file: working.tu56\r\n', '')
    ).removeprefix('continue\n')
    assert output.startswith('\nA HURKLE IS HIDING ON A 10 BY 10 GRID. HOMEBASE\n'), repr(output)
    assert re.findall(r'GO ([A-Z]+)\n', output) == hints, repr(output)
    assert [int(n) for n in re.findall(r'YOU FOUND HIM IN (\d+) GUESSES!', output)] == win_counts
    found = re.findall(r'THE HURKLE IS AT +(\d+) , +(\d+) ', output)
    assert [(int(x), int(y)) for x, y in found] == losses, repr(output)
    assert output.count("SORRY, THAT'S 5 GUESSES. \n") == len(losses), repr(output)
    assert output.count("LET'S PLAY AGAIN. HURKLE IS HIDING. \n") == len(win_counts) + len(losses)
    assert output.count('\x07' * 10 + '\n') == len(win_counts), repr(output)
    return output


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
    fixture = (root / 'scripts/package/fixtures/classic/hurkle-mar75-text.bas').read_bytes()
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
        transcripts = [capture_round(console, shared, *round_) for round_ in ROUNDS]
        shared['send_line'](console, '105 RANDOMIZE')
        assert capture_round(console, shared, *ROUNDS[-1]) == transcripts[-1]

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'clockWord': CLOCK_WORD,
        'rounds': [
            {'answers': round_[0], 'outputSha256': shared['digest'](output.encode('ascii'))}
            for round_, output in zip(ROUNDS, transcripts, strict=True)
        ],
        'randomizeAliasVerified': True,
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
