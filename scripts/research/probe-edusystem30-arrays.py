"""Check one-dimensional numeric arrays in archived EDU30.SV."""

import argparse
import runpy
from pathlib import Path


CASES = [
    (
        'explicit arrays and same-named scalars',
        [
            '10 DIM M(3),Y(2)', '20 M=2', '30 Y=3',
            '40 PRINT M;Y;M(0);M(3);Y(0);Y(2)', '50 M(3)=8',
            '60 Y(0)=7', '70 PRINT M;Y;M(3);Y(0)', '80 END',
        ],
        ' 2  3  0  0  0  0 \n 2  3  8  7 \n\n',
    ),
    (
        'fractional reads and writes',
        [
            '10 DIM A(3)', '20 A(.5)=10', '30 A(1+.5)=20', '40 A(3+.5)=40',
            '50 PRINT A(0);A(1);A(3+.5)', '60 END',
        ],
        ' 10  20  40 \n\n',
    ),
    (
        'negative fraction',
        ['10 DIM A(3)', '20 PRINT A(-.5)', '30 END'],
        '\nERROR SS AT LINE 0020\n\n',
    ),
    (
        'past the upper bound',
        ['10 DIM A(3)', '20 PRINT A(4)', '30 END'],
        '\nERROR SS AT LINE 0020\n\n',
    ),
    (
        'declaration after first access',
        ['10 A(3)=8', '20 DIM A(3)', '30 PRINT A(3)', '40 END'],
        ' 8 \n\n',
    ),
    (
        'zero bound',
        ['10 DIM A(0)', '20 END'],
        'S1 10\n\n',
    ),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    for name, lines, expected in CASES:
        with shared['edu30'](args.simulator.resolve(), tape) as console:
            for line in lines:
                shared['send_line'](console, line)
            for _ in range(2):
                shared['send_line'](console, 'RUN')
                console.expect_exact('EDUSYSTEM-30\r\n\r\n')
                console.expect_exact('READY')
                output = shared['normalize'](console.before)
                assert output == expected, (name, output)
        print(name)


if __name__ == '__main__':
    main()
