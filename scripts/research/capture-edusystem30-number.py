"""Reproduce NUMBER on the archived EDU30.SV interpreter in SIMH."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '131e582b14e81b35861f6ef0fc69e6977bd1ac4da24640098dcca248bb576ab2'
PROMPT = 'GUESS A NUMBER FROM 1 TO 5?'
GAMES = [
    (['3'] * 8 + ['2'] * 9,
     ['101', '106', '101', '102', '97', '92', '184', '189', '184', '368', '363', '358',
      '363', '368', '363', '358'], '716', 3),
    (['3', '1', '6', '4', '2', '1', '3', '3', '4', '2', '1'],
     ['101', '50.5', '101', '106', '111', '222', '227', '228', '456'], '912', 4),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    digest, edu30 = shared['digest'], shared['edu30']
    normalize, send_line = shared['normalize'], shared['send_line']
    tape = args.tape.resolve()
    assert digest(tape.read_bytes()) == shared['TAPE_SHA256']
    root = Path(__file__).resolve().parents[2]
    fixture = (root / 'scripts/package/fixtures/classic/number-mar75-text.bas').read_bytes()
    assert digest(fixture) == SOURCE_SHA256

    games = []
    with edu30(args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            send_line(console, line)
        for answers, scores, winning_score, jackpots in GAMES:
            send_line(console, 'RUN')
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            chunks = []
            for answer in answers:
                console.expect_exact(PROMPT)
                chunks.append(console.before + PROMPT)
                send_line(console, answer)
            console.expect_exact('READY')
            tail = normalize(console.before)
            assert tail.endswith(f'!!!!YOU WIN!!!! WITH  {winning_score} POINTS\n\n'), repr(tail)
            # Exclude input echo, the OS/8 banner and the final terminal newline.
            output = normalize(''.join(chunks)) + tail[:-1]
            assert re.findall(r'YOU HAVE  ([0-9.]+) POINTS', output) == scores, output
            assert output.count('YOU HIT THE JACKPOT') == jackpots, output
            if '6' in answers:
                assert PROMPT + PROMPT in output, output
            games.append({
                'answers': answers,
                'scores': scores,
                'winningScore': winning_score,
                'outputSha256': digest(output.encode('ascii')),
            })

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'games': games,
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
