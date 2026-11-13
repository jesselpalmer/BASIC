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
        'implicit array and same-named scalar',
        [
            '10 PRINT A(0);A(10);A', '20 A(0)=7', '30 A(10)=9',
            '40 A=42', '50 PRINT A(0);A(10);A', '60 END',
        ],
        ' 0  0  0 \n 7  9  42 \n\n',
    ),
    (
        'implicit upper bound',
        ['10 PRINT A(10.5)', '20 PRINT A(11)', '30 END'],
        ' 0 \n\nERROR SS AT LINE 0020\n\n',
    ),
    (
        'late declaration expands implicit bound',
        ['10 A(12)=9', '20 DIM A(12)', '30 PRINT A(12)', '40 END'],
        ' 9 \n\n',
    ),
    (
        'late declaration reduces implicit bound',
        ['10 PRINT A(5)', '20 DIM A(3)', '30 END'],
        '\nERROR SS AT LINE 0010\n\n',
    ),
    (
        'rank two requires an explicit declaration',
        ['10 PRINT A(0,0)', '20 END'],
        'S2 10\n\n',
    ),
    (
        'indexed character input into an implicit array',
        ['10 INPUT $A(10)', '20 PRINT A(10)', '30 END'],
        'Z 218 \n\n',
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
                if name == 'indexed character input into an implicit array':
                    console.send('Z')
                console.expect_exact('READY')
                output = shared['normalize'](console.before)
                assert output == expected, (name, output)
        print(name)


if __name__ == '__main__':
    main()
