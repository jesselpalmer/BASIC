"""Capture CHANGE transcripts and scalar words from archived EDU30.SV."""

import argparse
import json
import re
import runpy
import time
from pathlib import Path


CAPTURE = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'scripts/package/fixtures/classic'
RAW_SHA256 = '658c2681bf1ca9afa4d57a263e6758165ba390d561f76ee6a92fd53e915e1b13'
REVIEWED_SHA256 = '94983e92c1363ef39d6e23a10cc287ed316f5fbd6a28a643ecb880798cc46a95'
PRINTED_SALES = [('4.59', '10'), ('0.17', '5.00'), ('18.88', '20')]
OTHER_SALES = [('1.23', '1.23'), ('3.42', '2'), ('0', '16.91')]
EDGE_SALES = [('0.20', '1.20'), ('0.10', '1.10'), ('0.01', '0.51'), ('0.51', '1.01')]
PROBE = [
    '10 INPUT A', '20 INPUT P', '30 C=P-A', '40 F=INT(C)',
    '50 N=C*100', '60 G=N/50', '70 INPUT W', '75 GO TO 10', '80 END',
]
ARITHMETIC_PROBE = [
    '10 INPUT A', '20 INPUT P', '30 C=P-A', '40 F=P+A',
    '50 N=P*A', '60 G=P/A', '70 INPUT W', '75 GO TO 10', '80 END',
]
ARITHMETIC_INPUTS = [
    ('0.2', '1.2'), ('0.1', '1.1'), ('0.01', '0.51'), ('0.51', '1.01'),
    ('10', '4.59'), ('4.59', '10'), ('123.45', '0'), ('1', '1'),
    ('8', '0.125'), ('0.125', '8'), ('32', '7'), ('-3.25', '17.13'),
    ('-10', '-4.59'), ('-4.59', '-10'), ('4096', '0.03125'), ('0.03125', '4096'),
]
# These locations are for the exact compiled probe, with the high and low
# mantissa words following the signed exponent.
SCALARS = {'A': 0o17575, 'P': 0o17572, 'C': 0o17567,
           'F': 0o17564, 'N': 0o17561, 'G': 0o17556}


def capture_sales(console, source):
    sales = PRINTED_SALES + OTHER_SALES + EDGE_SALES
    answers = [value for sale in sales for value in sale]
    transcript = CAPTURE['capture_numeric_input_run'](console, source.splitlines(), answers)
    for amount in ('5.41', '4.83', '1.12', '16.91', '1', '.5'):
        assert 'YOUR CHANGE,$ ' + amount + ' \n' in transcript
    assert 'CORRECT AMOUNT,THANK YOU\n' in transcript
    assert 'SORRY,YOU HAVE SHORT CHANGED ME $ 1.42 \n' in transcript
    assert '\n 2 ONE-HALF DOLLAR(S)\n-1 QUARTER(S)\n' in transcript
    assert transcript.endswith('COST OF ITEM?')
    return {'sales': sales, 'output': transcript}


def read_scalar_words(console):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('examine 17556-17577')
    console.expect_exact('sim> ')
    words = {}
    for line in CAPTURE['normalize'](console.before).splitlines():
        match = re.fullmatch(r'([0-7]+):\s+([0-7]{4})', line)
        if match:
            address, word = match.groups()
            words[int(address, 8)] = word
            continue
        repeated = re.fullmatch(r'([0-7]+): thru ([0-7]+): same as above\.', line)
        if repeated:
            first, last = (int(address, 8) for address in repeated.groups())
            words.update(dict.fromkeys(range(first, last + 1), words[first - 1]))
    assert set(words) == set(range(0o17556, 0o17600)), words
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    # SIMH switches the terminal back to emulation and flushes queued input.
    time.sleep(0.5)
    return {name: [words[address + offset] for offset in range(3)]
            for name, address in SCALARS.items()}


def capture_words(console, source, inputs, input_label):
    send_line = CAPTURE['send_line']
    for line in source:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    observations = []
    for left, right in inputs:
        for value in (left, right):
            console.expect_exact('?')
            send_line(console, value)
        console.expect_exact('?')
        observations.append({
            input_label: [left, right],
            'scalarWordsOctal': read_scalar_words(console),
        })
        send_line(console, '1')
    console.expect_exact('?')
    console.sendcontrol('c')
    console.expect_exact('READY')
    return {
        'source': '\n'.join(source),
        'scalarAddressesOctal': {name: f'{address:05o}' for name, address in SCALARS.items()},
        'observations': observations,
    }


def arithmetic_inputs():
    def decimal(cents, negative):
        units, remainder = divmod(cents, 100)
        fraction = f'{remainder:02d}'.rstrip('0') or '0'
        return f'{"-" if negative else ""}{units}.{fraction}'

    samples = list(ARITHMETIC_INPUTS)
    for index in range(1, 42):
        left = decimal((index * 1129) % 9919 + 1, index % 2 == 0)
        right = decimal((index * 1373) % 9971 + 1, index % 3 == 0)
        samples.append((left, right))
    return samples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--arithmetic', action='store_true')
    args = parser.parse_args()
    digest = CAPTURE['digest']
    assert digest(args.tape.read_bytes()) == CAPTURE['TAPE_SHA256']
    result = {
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
    }
    if args.arithmetic:
        with CAPTURE['edu30'](args.simulator.resolve(), args.tape.resolve()) as console:
            result['arithmeticProbe'] = capture_words(
                console, ARITHMETIC_PROBE, arithmetic_inputs(), 'inputs',
            )
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')
        return
    raw = (FIXTURES / 'change.bas').read_bytes()
    source = (FIXTURES / 'change-mar75-text.bas').read_bytes()
    assert digest(raw) == RAW_SHA256 and digest(source) == REVIEWED_SHA256
    with CAPTURE['edu30'](args.simulator.resolve(), args.tape.resolve()) as console:
        game = capture_sales(console, source.decode('ascii'))
    with CAPTURE['edu30'](args.simulator.resolve(), args.tape.resolve()) as console:
        numeric_probe = capture_words(console, PROBE, EDGE_SALES, 'sale')
    result.update({
        'rawSha256': RAW_SHA256,
        'fixtureSha256': REVIEWED_SHA256,
        'game': game,
        'numericProbe': numeric_probe,
    })
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
