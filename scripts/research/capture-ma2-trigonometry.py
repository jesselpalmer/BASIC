"""Capture original V4A-12 MA2 trigonometric words through the linked routines."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile


LOADER_SHA256 = 'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596'
SIMULATOR_COMMIT = '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6'
# Skip the argument-shape checking prologue, passing one already-stored float.
ENTRIES = [0o103312, 0o103272, 0o73672]
TRAPS = [0o100742, 0o101026, 0o101420, 0o101714, 0o101704]


def cases():
    inputs = [(0, 0)]

    def add(high, low):
        for sign in (0, 32768):
            pair = (high | sign, low)
            if pair not in inputs:
                inputs.append(pair)

    # Exact integers, stored half-pi/tau, their adjacent values and phase limits.
    for number in [1, 2, 3, 4, 8, 9, 10, 32768, 65536, 131072, 262136, 262137, 327680]:
        exponent = number.bit_length()
        significand = number << (24 - exponent)
        add((exponent + 128) * 128 + (significand >> 16) - 128, significand & 65535)
    for high in (0o40311, 0o40711):
        for low in (0o7732, 0o7733, 0o7734):
            add(high, low)
    for exponent in (1, 2, 60, 80, 100, 127, 128, 129, 130, 144, 145, 146, 147, 148, 150, 152, 180, 255):
        for significand in (0x800000, 0x800001, 0xB504F3, 0xFFFFFE, 0xFFFFFF):
            add(exponent * 128 + (significand >> 16) - 128, significand & 65535)
    seed = 20261119
    for _ in range(64):
        seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
        significand = 0x800000 | (seed & 0x7FFFFF)
        seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
        exponent = 1 + seed % 255
        add(exponent * 128 + (significand >> 16) - 128, significand & 65535)
    return [(high, low, operation) for high, low in inputs for operation in range(3)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--loader', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    loader = args.loader.resolve()
    if any(character in str(loader) for character in '\r\n"'):
        raise ValueError('Unsupported loader pathname')
    if hashlib.sha256(loader.read_bytes()).hexdigest() != LOADER_SHA256:
        raise ValueError('Loader does not match the pinned V4A-12 MA2 build')
    selected = cases()
    lines = ['SET CPU 11/05', 'SET CPU 64K', f'LOAD "{loader}"', 'BREAK 140020']
    lines.extend(f'BREAK {pc:o}' for pc in TRAPS)
    for index, (high, low, operation) in enumerate(selected):
        lines.extend([
            f'ECHO CASE {index}', f'DEPOSIT 140000 {high:o}', f'DEPOSIT 140002 {low:o}',
            'DEPOSIT 150000 140020', 'DEPOSIT 140020 0',
            *[f'DEPOSIT R{register} {0o140000 if register == 1 else 0:o}' for register in range(6)],
            'DEPOSIT SP 150000', 'DEPOSIT PSW 0', f'DEPOSIT PC {ENTRIES[operation]:o}',
            'STEP 10000', 'EXAMINE PC', 'EXAMINE R1', 'EXAMINE R4',
            *[f'EXAMINE {address:o}' for address in range(0o137774, 0o140004, 2)],
        ])
    lines.append('QUIT')
    with tempfile.TemporaryDirectory(prefix='ma2-trig-') as directory:
        script = Path(directory) / 'capture.ini'
        script.write_text('\n'.join(lines) + '\n', encoding='ascii')
        output = subprocess.run(
            [str(args.simulator.resolve()), str(script)], capture_output=True,
            text=True, timeout=120, check=True,
        ).stdout
    assert SIMULATOR_COMMIT[:8] in output
    chunks = re.split(r'^CASE \d+\s*$', output, flags=re.M)[1:]
    assert len(chunks) == len(selected)
    rows = []
    for case, chunk in zip(selected, chunks, strict=True):
        def read(name):
            match = re.search('^' + name + r':\s+([0-7]{6})', chunk, flags=re.M)
            assert match, (case, name, chunk)
            return int(match[1], 8)
        pc = read('PC')
        assert pc == 0o140020 or pc in TRAPS, (case, chunk)
        pointer = read('R1')
        assert 0o137700 <= pointer <= 0o140000, (case, chunk)
        if pc == 0o140020:
            assert pointer in (0o137774, 0o140000), (case, chunk)
            result = [0, read(f'{pointer:o}'), read(f'{pointer + 2:o}')]
        elif pc == 0o101704:
            result = [61, None, None]
        else:
            # Sine's bounded polynomial can underflow on tiny arguments; its
            # normal range reduction and coefficients cannot overflow.
            if pc != 0o101026:
                exponent = read('R4')
                assert exponent >= 32768 or exponent == 0, (case, chunk)
            result = [48, None, None]
        rows.append([*case, *result])
    normalized = re.sub(r'^.*?capture\.ini-(\d+)>', r'<capture.ini>-\1>', output, flags=re.M)
    args.output.write_text(json.dumps({
        'simulatorCommit': SIMULATOR_COMMIT, 'loaderSha256': LOADER_SHA256,
        'entryOctal': [f'{entry:o}' for entry in ENTRIES],
        'operationOrder': ['sine', 'cosine', 'tangent'],
        'columns': ['inputHigh', 'inputLow', 'operation', 'event', 'resultHigh', 'resultLow'],
        'instructionBoundPerCall': 10000,
        'captureSha256': hashlib.sha256(normalized.encode()).hexdigest(), 'rows': rows,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
