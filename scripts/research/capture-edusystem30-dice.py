"""Capture two DICE rounds and a fresh RUN on archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import re
import runpy


ROLLS_PROMPT = 'HOW MANY ROLLS?'
REPLAY_PROMPT = 'TRY AGAIN'
RUNS = (
    ('replay', ['36', 'Y', '12', 'N']),
    ('fresh run', ['12', 'N']),
)


def capture_run(console, archive, answers):
    send_line = archive['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        if answer.isdecimal():
            console.expect_exact(ROLLS_PROMPT)
            chunks.append(console.before + ROLLS_PROMPT)
            send_line(console, answer)
        else:
            console.expect_exact(REPLAY_PROMPT)
            chunks.append(console.before + REPLAY_PROMPT)
            console.send(answer)
            console.expect_exact(answer)
            assert not console.before, repr(console.before)
    console.expect_exact('\0\r\nREADY')
    chunks.append(console.before)
    output = ''.join(chunks).replace(
        'DT0: writing buffer to file: working.tu56\r\n', '',
    ).replace('\r\n', '\n')
    assert '\r' not in output and '\0' not in output
    tables = re.findall(r'TOTAL SPOTS +NUMBER OF TIMES\n((?: +\d+ +\d+ \n){11})', output)
    counts = []
    for table in tables:
        rows = [tuple(map(int, line.split())) for line in table.splitlines()]
        assert [total for total, _ in rows] == list(range(2, 13))
        counts.append([count for _, count in rows])
    assert [sum(row) for row in counts] == [int(answer) for answer in answers if answer.isdecimal()]
    assert output.endswith(REPLAY_PROMPT), repr(output)
    return output, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    archive = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    digest = archive['digest']
    tape = args.tape.resolve()
    assert digest(tape.read_bytes()) == archive['TAPE_SHA256']
    fixtures = directory.parent / 'package/fixtures/classic'
    raw = (fixtures / 'dice.bas').read_bytes()
    reviewed = (fixtures / 'dice-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'dice-mark-adapted.bas').read_bytes()
    assert digest(raw) == 'b5d6fa09957b1f5eb780226c3e150dc6651a12e571290494adce94c0dea06e85'
    assert digest(reviewed) == 'de62170bac304a92aaf766f6bc3bdb7232380cc3912d08595bfa00760970548a'
    replacements = {
        b'140 A=INT(6*RND+1)': b'140 A=INT(6*RND(0)+1)',
        b'150 B=INT(6*RND+1)': b'150 B=INT(6*RND(0)+1)',
        b'223 INPUT Z$': b'223 INPUT $Z',
        b'224 IF Z$="YES" THEN 80': b'224 IF Z=#Y THEN 80',
    }
    assert adapted.splitlines() == [
        replacements.get(line, line) for line in reviewed.splitlines()
    ]
    with archive['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in adapted.decode('ascii').splitlines():
            archive['send_line'](console, line)
        runs = []
        for name, answers in RUNS:
            output, counts = capture_run(console, archive, answers)
            runs.append({'name': name, 'answers': answers, 'output': output, 'counts': counts})
    assert runs[0]['counts'][1] != runs[1]['counts'][0], 'A fresh RUN resets the random stream'
    args.output.write_text(json.dumps({
        'simulatorCommit': archive['SIMULATOR'],
        'tapeSha256': archive['TAPE_SHA256'],
        'rawFixtureSha256': digest(raw),
        'reviewedFixtureSha256': digest(reviewed),
        'fixtureSha256': digest(adapted),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
