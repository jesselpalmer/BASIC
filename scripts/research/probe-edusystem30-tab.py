"""Verify TAB's column movement and terminal bytes on archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


RESET = '\r\0'
BATCHES = (
    (
        ('0', '2', '3', '4', '3.49', '3.5', '3.9', '4.49', '4.5', '4.99', '70', '71'),
        (RESET, RESET + '  ', '', ' ', ' ', ' ', ' ', '  ', '  ', '  ', RESET, RESET + ' '),
    ),
    (
        ('0.1', '2.0001', '2.9999', '3.0001', '69', '69.9', '70', '70.1', '70.99', '140', '141', '142'),
        (RESET + ' ', '', '', ' ', ' ' * 66, ' ' * 67, RESET, RESET + ' ', RESET + ' ', RESET,
         RESET + ' ', RESET + '  '),
    ),
    (
        ('-.5', '-1', '-2.25', '-70', '-71'),
        (' ' * 67, ' ' * 66, ' ' * 65, RESET, ' ' * 66),
    ),
)
CONTINUED_SOURCE = ['150 PRINT TAB(4);"B";', '160 PRINT TAB(2);"C";', '170 PRINT TAB(6);"D"']
CONTINUED_OUTPUT = '    B' + RESET + '  C   D'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    captured = []
    for expressions, positions in BATCHES:
        source = [
            f'{10 * i} PRINT "ABC";TAB({expression});"X"'
            for i, expression in enumerate(expressions, start=1)
        ]
        source.extend(CONTINUED_SOURCE)
        source.append('180 END')
        expected = [f'ABC{position}X' for position in positions] + [CONTINUED_OUTPUT]
        with shared['edu30'](args.simulator.resolve(), tape) as console:
            for line in [*source, 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            console.expect_exact('READY')
            # Preserve CR and NUL for both intra-line positioning and the READY epilogue.
            output = console.before
            assert output == '\r\n'.join(expected) + '\r\n\0\r\n', repr(output)
        captured.append({'source': source, 'output': output})
    print(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'probes': captured,
    }, indent=2))


if __name__ == '__main__':
    main()
