"""Verify DIGITS compiler diagnostics and supported component forms on EDU30.SV."""

import argparse
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


FIXTURES = [
    (
        'pinned DIGITS',
        'digits.bas',
        '260c8a3d4fe9850736db416b5320e18bc5011962c0b181586d916f6e308ac2fa',
        'S1 400\nS1 400\nS1 420\nS1 420\nS1 440\nS1 730\nUL 760\nUL 1110\n\n',
    ),
    (
        'reviewed DIGITS',
        'digits-mar75-text.bas',
        '1f282771128cd8170422071b64a4c43f0ab9d19afdf9457ec95942f20a2aef9b',
        'S1 400\nS1 400\nS1 420\nS1 420\nS1 440\nS1 730\n\n',
    ),
]
PROBES = [
    (
        'MAT CON',
        '10 DIM M(2,2)\n20 MAT M=CON\n30 PRINT M(0,0);M(1,1);M(2,2)\n40 END',
        (),
        'S1 20\n\n',
    ),
    (
        'MAT scalar multiplication',
        '10 DIM K(2,2)\n20 K(1,1)=2\n30 MAT K=(9)*K\n40 PRINT K(1,1)\n50 END',
        (),
        'S1 30\n\n',
    ),
    ('bare RND', '10 PRINT RND\n20 END', (), 'S1 10\n\n'),
    ('SGN', '10 PRINT SGN(-.5);SGN(0);SGN(.5)\n20 END', (), '-1  0  1 \n\n'),
    (
        'ten implicit indexed INPUT targets',
        '10 INPUT N(1),N(2),N(3),N(4),N(5),N(6),N(7),N(8),N(9),N(10)\n'
        '20 PRINT N(1);N(2);N(3);N(4);N(5);N(6);N(7);N(8);N(9);N(10)\n30 END',
        ('1,0,2,0,2,1,1,1,2', '0'),
        '?? 1  0  2  0  2  1  1  1  2  0 \n\n',
    ),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    simulator = args.simulator.resolve()
    cases = list(PROBES)
    for name, file_name, sha256, expected in FIXTURES:
        source = (directory.parent / 'package/fixtures/classic' / file_name).read_bytes()
        assert shared['digest'](source) == sha256
        cases.append((name, source.decode('ascii'), (), expected))

    def verify(case):
        name, source, answers, expected = case
        with shared['edu30'](simulator, tape) as console:
            for line in [*source.splitlines(), 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            output = ''
            for answer in answers:
                console.expect_exact('?')
                output += console.before + '?'
                shared['send_line'](console, answer)
            console.expect_exact('READY')
            output = shared['normalize'](output + console.before)
        assert output == expected, (name, repr(output))
        return name

    # Each case gets a fresh simulator and a private tape copy.
    with ThreadPoolExecutor(max_workers=4) as executor:
        for name in executor.map(verify, cases):
            print(f'Verified {name}', flush=True)


if __name__ == '__main__':
    main()
