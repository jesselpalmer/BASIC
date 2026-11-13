"""Capture stored exponential results from the archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


ROOTS = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-roots.py')))
CAPTURE = ROOTS['CAPTURE']
SOURCE = [
    '10 INPUT A', '20 P=EXP(A)', '30 PRINT P', '40 INPUT W', '45 GO TO 10', '50 END',
]
INPUTS = [
    '0', '1', '-1', '2', '-2', '.1', '-.1', '.693147', '-.693147', '.693148', '-.693148',
    '2.35', '-2.35', '-.0225', '-.5625', '-1.5625', '-3.6225', '-6.5225', '-9',
    '10', '-10', '100', '-100', '700', '-700', '1E-40', '-1E-40', '1E-300', '-1E-300',
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    tape = args.tape.resolve()
    assert CAPTURE['digest'](tape.read_bytes()) == CAPTURE['TAPE_SHA256']
    with CAPTURE['edu30'](args.simulator.resolve(), tape) as console:
        exponential = ROOTS['capture'](console, SOURCE, INPUTS, 'AP')
    args.output.write_text(json.dumps({
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        **exponential,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
