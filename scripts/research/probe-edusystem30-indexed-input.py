"""Verify indexed character input against the pinned EDU30.SV archive."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import runpy


CASES = [
    (True, ['10 DIM A(3)', '20 INPUT $A(0)', '30 INPUT $X', '40 INPUT $A(1)',
            '50 PRINT A(0);X;A(1)', '60 END'], [(None, 'Ab\r')],
     'Ab\r 65  98  13 \r\n'),
    (False, ['10 DIM A(3)', '20 INPUT $A(0)', '30 INPUT $X', '40 INPUT $A(1)',
             '50 PRINT A(0);X;A(1)', '60 END'], [(None, 'Ab\r')],
     'Ab\r 193  226  141 \r\n'),
    (False, ['10 DIM A(3,2)', '20 I=1', '30 INPUT$A(I,2)', '40 PRINT A(1,2)', '50 END'],
     [(None, 'J\r')], 'J 202 \r\n'),
    (False, ['10 DIM A(3)', '20 INPUT X', '30 INPUT $A(0)', '40 INPUT Y', '50 INPUT Z',
             '60 PRINT X;A(0);Y;Z', '70 END'],
     [('?', '42,77\r'), (None, 'B54\r')], '?42,77\r\nB?54\r\n 42  194  77  54 \r\n'),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']

    def verify(case):
        space, source, answers, expected = case
        with shared['edu30'](args.simulator.resolve(), tape, space_parity=space) as console:
            console.delaybeforesend = 0.01
            for line in [*source, 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            output = []
            for prompt, text in answers:
                if prompt:
                    console.expect_exact(prompt)
                    output.append(console.before + prompt)
                console.send(text)
            console.expect_exact('\x00\r\nREADY')
            output.append(console.before)
            actual = ''.join(output)
            assert actual == expected, (actual, expected)

    with ThreadPoolExecutor() as pool:
        list(pool.map(verify, CASES))
    print(f'Verified {len(CASES)} indexed INPUT cases')


if __name__ == '__main__':
    main()
