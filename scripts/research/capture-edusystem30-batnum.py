"""Reproduce the reviewed BATNUM listing on archived EDU30.SV in SIMH."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = 'c66b9a6302d7ca27f199eecf1a3e75a017d99365159d641bb60f94c1c63d6a7f'
SOURCE_SHA256 = '6960df4706851d41b42e548b5191d5a31b12e241dd6c1a8d9d486a1c17db3741'
PILE_PROMPT = 'ENTER PILE SIZE:?'
OUTCOMES = re.compile(
    r'COMPUTER TAKES \d+ AND (?:LOSES|WINS)\. |TOUGH LUCK, YOU LOSE\. '
    r'|CONGRATULATIONS, YOU WIN\. |I TOLD YOU NOT TO USE ZERO\.\.\.COMPUTER WINS BY FORFEIT\. '
)
PRINTED_MOVES = [
    (1, 20), (1, 16), (1, 12), (1, 8), (1, 4),
    (2, 21), (1, 17), (2, 13), (3, 9), (3, 5), (1, 1),
    (1, 24), (1, 19), (1, 14), (1, 9), (1, 4),
]
RUNS = [
    (
        [
            '23', '2', '1,3', '2', '2', '3', '3', '3', '3', '3',
            '23', '2', '1,3', '1', '3', '2', '1', '1', '3', '1',
            '27', '1', '1,4', '2', '2', '4', '4', '4', '4', '4',
        ],
        ['COMPUTER TAKES 1 AND LOSES.', 'TOUGH LUCK, YOU LOSE.', 'CONGRATULATIONS, YOU WIN.'],
    ),
    (
        ['0', '5', '1', '3,1', '1,3', '2', '4', '0', '2', '1', '1,3', '1'],
        ['I TOLD YOU NOT TO USE ZERO...COMPUTER WINS BY FORFEIT.', 'COMPUTER TAKES 2 AND WINS.'],
    ),
]


def capture_run(console, shared, answers, expected_outcomes):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact(PILE_PROMPT)
    chunks.append(console.before + PILE_PROMPT)
    console.sendcontrol('c')
    console.expect_exact('READY')
    output = shared['normalize'](
        ''.join(chunks).replace('DT0: writing buffer to file: working.tu56\r\n', '')
    )
    assert output.startswith("THIS PROGRAM IS A 'BATTLE OF NUMBERS'\n"), repr(output)
    assert [match.rstrip() for match in OUTCOMES.findall(output)] == expected_outcomes, repr(output)
    if answers == RUNS[0][0]:
        moves = re.findall(r'COMPUTER TAKES (\d+) AND LEAVES (\d+) ', output)
        assert [(int(taken), int(left)) for taken, left in moves] == PRINTED_MOVES, moves
    else:
        assert PILE_PROMPT * 2 in output, repr(output)
        assert 'ENTER MIN AND MAX: ?ENTER MIN AND MAX: ?' in output, repr(output)
        assert 'ILLEGAL MOVE, REENTER IT: ?' in output, repr(output)
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
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    assert shared['digest']((fixtures / 'batnum.bas').read_bytes()) == RAW_SHA256
    fixture = (fixtures / 'batnum-mar75-text.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            shared['send_line'](console, line)
        transcripts = [capture_run(console, shared, *run) for run in RUNS]

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'runs': [
            {'answers': run[0], 'outputSha256': shared['digest'](output.encode('ascii'))}
            for run, output in zip(RUNS, transcripts, strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
