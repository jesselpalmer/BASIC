"""Reproduce the printed ROCKET landing and a crash on archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = '401d6665afacbccb1a4486607bce33ad2e023522534e8bdffc63d9321e96d38c'
SOURCE_SHA256 = '25afb43125155c40d632de746101bae10516eb5e1e2452c65762ea8001dc2193'
PRINTED_ROWS = [
    '0 120 0 3600 16500', '10 109 5015 3636 16500',
    '20 99 4223 3672 16500', '30 89 2903 3708 16500',
    '40 79 1055 3744 16500', '50 68 3959 3780 16500',
    '60 58 1055 3816 16500', '70 47 2903 3852 16500',
    '80 37 1883 3482.87 14500', '90 28 1191 3086.7 12500',
    '100 20 1251 2659.65 10500', '110 13 2549 2196.94 8500',
    '120 8 370 1692.63 6500', '130 4 658 1139.13 4500',
    '140 1 4203 526.598 2500', '150 0 4042 212.242 1500',
    '160 0 1863 84.1831 1050', '170 0 908 45.9129 850',
    '180 0 438 18.107 680', '190 0 241 8.68632 560',
    '200 0 157 2.7691 450', '210 0 105 4.27036 360',
    '220 0 46 3.65466 265', '230 0 7 1.66462 167',
]
PRINTED_BURNS = [
    *(['0'] * 7), *(['200'] * 7),
    '100', '45', '20', '17', '12', '11', '9', '9.5', '9.8', '9.3',
]
RUNS = [
    (PRINTED_BURNS, 'GOOD LANDING (COULD BE BETTER)'),
    (['0'] * 12, 'SORRY, BUT THERE WERE NO SURVIVORS...YOU BLEW IT!'),
]
REPLAY = 'TRY AGAIN??\r\n'
FIRST_ROW = ' 0             120  0        3600          16500        ?'


def capture_run(console, shared, answers, outcome):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact(REPLAY)
    chunks.append(console.before + REPLAY)
    console.expect_exact('?')
    chunks.append(console.before + '?')
    console.sendcontrol('c')
    console.expect_exact('READY')
    output = shared['normalize'](
        ''.join(chunks).replace('DT0: writing buffer to file: working.tu56\r\n', '')
    )
    assert output.startswith('THIS IS A COMPUTER SIMULATION OF AN APOLLO LUNAR\n'), repr(output)
    assert output.endswith(FIRST_ROW), repr(output)
    assert '\n' + outcome + '\n' in output, repr(output)
    assert 'SEC           MI + FT       MPH           LB FUEL       BURN RATE\n' in output
    if answers == PRINTED_BURNS:
        rows = re.findall(r'(?:^|(?<=\?)) (\d+ +\d+ +\d+ +[.\d]+ +\d+) +(?=\?)', output, re.M)
        assert [' '.join(row.split()) for row in rows] == PRINTED_ROWS + [PRINTED_ROWS[0]], rows
        assert 'ON MOON AT 233.183 SEC - IMPACT VELOCITY 1.6042 MPH\n' in output, repr(output)
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
    assert shared['digest']((fixtures / 'rocket.bas').read_bytes()) == RAW_SHA256
    fixture = (fixtures / 'rocket-mar75-text.bas').read_bytes()
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
            {'answers': answers, 'outputSha256': shared['digest'](output.encode('ascii'))}
            for (answers, _), output in zip(RUNS, transcripts, strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
