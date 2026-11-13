"""Capture stored LOG results and domain diagnostics from archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


ROOTS = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-roots.py')))
CAPTURE = ROOTS['CAPTURE']
SOURCE = [
    '10 INPUT A', '20 P=LOG(A)', '30 PRINT P', '40 INPUT W', '45 GO TO 10', '50 END',
]
INPUTS = [
    '1', '2', '3', '4', '8', '9', '10', '16', '31', '32', '64', '100', '128', '1024',
    '.1', '.25', '.5', '.75', '.999999', '1.000001', '1.5', '2.35', '3.141592',
    '999999', '1E-40', '1E40', '1E-300', '1E300', '-1', '-2', '-.5', '-3.141592',
]


def domain(console, value):
    for line in SOURCE:
        CAPTURE['send_line'](console, line)
    CAPTURE['send_line'](console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('?')
    CAPTURE['send_line'](console, value)
    console.expect_exact('READY')
    output = CAPTURE['normalize'](console.before)
    assert output == '\nERROR LG AT LINE 0020\n\n', repr(output)
    return {'input': value, 'output': output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    simulator = args.simulator.resolve()
    tape = args.tape.resolve()
    assert CAPTURE['digest'](tape.read_bytes()) == CAPTURE['TAPE_SHA256']
    with CAPTURE['edu30'](simulator, tape) as console:
        logarithm = ROOTS['capture'](console, SOURCE, INPUTS, 'AP')
    errors = []
    for value in ('0',):
        with CAPTURE['edu30'](simulator, tape) as console:
            errors.append(domain(console, value))
    args.output.write_text(json.dumps({
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        **logarithm,
        'domain': errors,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
