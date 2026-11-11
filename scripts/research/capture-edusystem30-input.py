"""Capture the stored values produced by numeric INPUT in archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


CHANGE = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-change.py')))
CAPTURE = CHANGE['CAPTURE']
SCALARS = CHANGE['SCALARS']
SOURCE = ['10 INPUT A,P,C,F,N,G', '20 INPUT W', '30 GO TO 10', '40 END']
SAMPLES = [
    '4.59', '10', '0.17', '5.00', '18.88', '20', '1.23', '3.42', '2', '0', '16.91',
    '0.20', '1.20', '0.10', '1.10', '0.01', '0.51', '1.01',
    '.51', '1.', '+1.01', '-1.01', '-.51', '-0',
    '0.5', '0.50', '0.500', '0.5000', '0.50000000', '0.500000000',
    '0.1234567', '0.12345678', '0.123456789', '-0.123456789',
    '8388607', '8388608', '8388609', '16777215', '16777216', '123456789',
    '-8388609', '0.99999999', '99999999.99999999', '0000001.0200',
    '1E0', '1E+2', '1E-2', '1.25E+8', '1.25E-8', '1.25E+9',
    '1.25E-9', '1.25E+18', '1.25E-18', '-1.25E-18',
    '1E+99', '1E-99', '1E+100', '1E-100', '1E+300', '1E-300',
    '0E-300', '-1E+300', '0.00000001', '0.000000001',
    '0.0000000000000001', '1.0000000000000001',
]


def capture_input_words(console):
    send_line = CAPTURE['send_line']
    for line in SOURCE:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    observations = []
    batch_size = len(SCALARS)
    assert len(SAMPLES) % batch_size == 0
    for start in range(0, len(SAMPLES), batch_size):
        batch = SAMPLES[start:start + batch_size]
        for sample in batch:
            console.expect_exact('?')
            assert not console.before.strip(), (sample, console.before)
            send_line(console, sample)
        console.expect_exact('?')
        assert not console.before.strip(), console.before
        stored = CHANGE['read_scalar_words'](console)
        for sample, scalar in zip(batch, SCALARS):
            observations.append({'input': sample, 'wordsOctal': stored[scalar]})
        send_line(console, '1')
    console.expect_exact('?')
    console.sendcontrol('c')
    console.expect_exact('READY')
    return observations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    assert CAPTURE['digest'](args.tape.read_bytes()) == CAPTURE['TAPE_SHA256']
    with CAPTURE['edu30'](args.simulator.resolve(), args.tape.resolve()) as console:
        observations = capture_input_words(console)
    result = {
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        'inputProbe': {
            'source': '\n'.join(SOURCE),
            'scalarAddressesOctal': {name: f'{address:05o}' for name, address in SCALARS.items()},
            'observations': observations,
        },
    }
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
