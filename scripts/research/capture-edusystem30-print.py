"""Capture EDU30.SV numeric PRINT fields and the corresponding stored words."""

import argparse
import json
import re
import runpy
from pathlib import Path


CHANGE = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-change.py')))
CAPTURE = CHANGE['CAPTURE']
SCALAR_PROBE = [
    '10 INPUT A', '20 PRINT "L";A;"R";-A;"X"',
    '30 INPUT W', '40 GO TO 10', '50 END',
]
SCALAR_INPUTS = [
    '0', '-0', '1', '-2', '0.01', '0.10', '0.12', '.1249998', '.1249999', '.125',
    '.13', '.2', '.5', '.51', '.12345678', '.23456789', '.999999', '.9999993',
    '.9999994', '.9999998', '1.000001', '1.234564', '1.234567', '1.234568',
    '1.234569', '1.234575', '1.234585', '4.59', '5.41', '-4.83', '16.91',
    '100', '12345.67', '123456.9', '999999', '999999.25', '1000000',
    '1000000.125', '1048575.75', '1048575.875', '1048576', '1234567',
    '1E8', '1E-8', '1E40', '1E-40',
]
FORM_PROBE = [
    '10 INPUT A,P', '20 C=P-A', '30 PRINT "CHANGE,$";C',
    '40 PRINT "SHORT,$";A-P', '50 PRINT INT(C);" BILL(S)"',
    '60 PRINT C;', '70 PRINT "END OF LINE"', '80 PRINT C;C',
    '90 GO TO 10', '100 END',
]
FORM_INPUTS = ['4.59,10', '0.10,1.10', '0.51,1.01', '3.42,2', '0,0']
ARITHMETIC_PROBE = [
    '10 INPUT A,P', '20 C=P-A', '30 PRINT "A";A;"P";P;"C";C',
    '40 GO TO 10', '50 END',
]


def scalar_print(console):
    send_line = CAPTURE['send_line']
    for line in SCALAR_PROBE:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    rows = []
    for value in SCALAR_INPUTS:
        console.expect_exact('?')
        send_line(console, value)
        console.expect_exact('?')
        printed = CAPTURE['normalize'](console.before)
        fields = re.fullmatch(r'L([ -][.0-9E-]+ )R([ -][.0-9E-]+ )X\n', printed)
        assert fields, (value, printed)
        rows.append({
            'input': value,
            'scalarWordsOctal': CHANGE['read_scalar_words'](console)['A'],
            'field': fields[1],
            'negatedField': fields[2],
        })
        send_line(console, '1')
    console.expect_exact('?')
    console.sendcontrol('c')
    console.expect_exact('READY')
    return {'source': '\n'.join(SCALAR_PROBE), 'observations': rows}


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
        scalars = scalar_print(console)
    with CAPTURE['edu30'](simulator, tape) as console:
        forms = CAPTURE['capture_numeric_input_run'](console, FORM_PROBE, FORM_INPUTS)
    arithmetic_answers = [','.join(pair) for pair in CHANGE['arithmetic_inputs']()]
    with CAPTURE['edu30'](simulator, tape) as console:
        arithmetic = CAPTURE['capture_numeric_input_run'](
            console, ARITHMETIC_PROBE, arithmetic_answers,
        )
    result = {
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        'scalarProbe': scalars,
        'formProbe': {'source': '\n'.join(FORM_PROBE), 'inputs': FORM_INPUTS, 'output': forms},
        'arithmeticProbe': {
            'source': '\n'.join(ARITHMETIC_PROBE),
            'inputCount': len(arithmetic_answers),
            'outputSha256': CAPTURE['digest'](arithmetic.encode('ascii')),
        },
    }
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
