"""Capture square-root and integer-power results from archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


CHANGE = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-change.py')))
CAPTURE = CHANGE['CAPTURE']
ROOT_SOURCE = [
    '10 INPUT A', '20 P=SQR(A)', '30 PRINT P', '40 INPUT W', '45 GO TO 10', '50 END',
]
ROOT_INPUTS = [
    '0', '1', '2', '3', '4', '5', '10', '100', '0.1', '0.999', '1.000001',
    '0.00003', '0.01', '3.141592', '999999', '1E-40', '1E40', '-4',
]
POWER_SOURCE = [
    '10 INPUT A,P', '20 C=A^P', '30 PRINT C', '40 INPUT W', '45 GO TO 10', '50 END',
]
POWER_INPUTS = [
    ('2', '0'), ('2', '1'), ('-2', '0'), ('0', '1'), ('0', '2'), ('1', '2'), ('2', '2'), ('2', '3'), ('2', '4'), ('2', '5'),
    ('-2', '2'), ('-2', '3'), ('0.1', '2'), ('0.1', '3'), ('0.1', '4'),
    ('0.1', '5'), ('0.387654', '2'), ('0.387654', '3'), ('0.387654', '4'),
    ('0.387654', '5'), ('0.1234567', '5'), ('1.2', '2'), ('1.2', '3'),
    ('1.2', '4'), ('1.2', '5'), ('3.141592', '3'),
    ('0', '6'), ('0.9', '6'), ('0.9', '7'), ('0.387654', '8'), ('0.9', '20'), ('1.2', '20'),
]


def capture(console, source, samples, names):
    send_line = CAPTURE['send_line']
    for line in source:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    observations = []
    for text in samples:
        console.expect_exact('?')
        send_line(console, text)
        console.expect_exact('?')
        output = CAPTURE['normalize'](console.before)
        words = CHANGE['read_scalar_words'](console)
        observations.append({
            'input': text,
            'output': output,
            'words': {name: words[name] for name in names},
        })
        send_line(console, '0')
    console.expect_exact('?')
    console.sendcontrol('c')
    console.expect_exact('READY')
    return {'source': '\n'.join(source), 'observations': observations}


def capture_zero_power(console):
    send_line = CAPTURE['send_line']
    for line in POWER_SOURCE:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('?')
    send_line(console, '0,0')
    console.expect_exact('READY')
    output = CAPTURE['normalize'](console.before)
    assert output == '\nERROR LG AT LINE 0020\n\n', repr(output)
    return {'input': '0,0', 'output': output}


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
        square_root = capture(console, ROOT_SOURCE, ROOT_INPUTS, 'AP')
    with CAPTURE['edu30'](simulator, tape) as console:
        power = capture(console, POWER_SOURCE, [','.join(pair) for pair in POWER_INPUTS], 'APC')
    with CAPTURE['edu30'](simulator, tape) as console:
        zero_power = capture_zero_power(console)
    args.output.write_text(json.dumps({
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        'squareRoot': square_root,
        'power': power,
        'zeroPower': zero_power,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
