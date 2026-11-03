"""Capture original canonical MA2 CMPF calls; no arithmetic model supplies order.

Obtain the pinned loader and simulator separately. See docs/basic-plus-ma2-values.md.
Normal CI consumes offline observations without executing the historical binary.
"""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, tempfile
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--simulator', type=Path, required=True)
parser.add_argument('--loader', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
loader = args.loader.resolve()
if any(c in str(loader) for c in '\r\n"'):
    raise ValueError('Loader pathname contains a SIMH command delimiter')
loader_hash = hashlib.sha256(loader.read_bytes()).hexdigest()
if loader_hash != 'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596':
    raise ValueError('Loader does not match the pinned V4A MA2 build')
ws = [(0, 0)]
for exponent in [1, 127, 128, 129, 130, 150, 151, 152, 153, 255]:
    for fraction in [0, 1, 0x7fffff]:
        for sign in [0, 32768]:
            ws.append((sign + exponent * 128 + (fraction >> 16), fraction & 65535))
ws += [(0x40c0, 0), (0xc0c0, 0), (0x4120, 0), (0xc120, 0)]
pairs = []


def add(left, right):
    if (left, right) not in pairs:
        pairs.append((left, right))


one = (0x4080, 0)
zero = (0, 0)
for index, words in enumerate(ws):
    for other in [zero, one, (0xc080, 0), words, ws[(index + 1) % len(ws)]]:
        add(words, other)
        add(other, words)
seed = 20261104


def rand():
    global seed
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return seed


def generated_word():
    exponent = 1 + rand() % 255
    fraction = rand() & 0x7fffff
    sign = rand() & 1
    return (sign * 32768 + exponent * 128 + (fraction >> 16), fraction & 65535)


for _ in range(96):
    left = generated_word()
    right = generated_word()
    add(left, right)
    add(right, left)
lines = [
    'SET CPU 11/05', 'SET CPU 64K', f'LOAD "{loader}"',
    'BREAK 140100', 'DEPOSIT 140100 0',
]
for index, (left, right) in enumerate(pairs):
    lines += (
        [f'ECHO CASE {index}']
        + [f'DEPOSIT {0o140000 + j * 2:o} {value:o}' for j, value in enumerate(right + left)]
        + [f'DEPOSIT R{j} {0o140000 if j == 1 else 0:o}' for j in range(6)]
        + [
            'DEPOSIT SP 150000', 'DEPOSIT 150000 140100', 'DEPOSIT PSW 0',
            'DEPOSIT PC 102264', 'STEP 1000', 'EXAMINE R0', 'EXAMINE R1', 'EXAMINE PSW',
        ]
    )
lines += ['QUIT']
with tempfile.TemporaryDirectory() as directory:
    script = Path(directory) / 'capture.ini'
    script.write_text('\n'.join(lines) + '\n')
    out = subprocess.run([str(args.simulator.resolve()), str(script)], text=True, capture_output=True, check=True, timeout=120).stdout
out = re.sub(r'^.*?capture\.ini-(\d+)>', r'<capture.ini>-\1>', out, flags=re.M)
assert '698dc8a1' in out
chunks = re.split(r'^CASE \d+\s*$',out,flags=re.M)[1:]
assert len(chunks) == len(pairs)
rows = []
for (left, right), chunk in zip(pairs, chunks):
    assert 'Breakpoint, PC: 140100' in chunk, chunk[-1000:]

    def read(key):
        return int(re.search('^' + key + r':\s+([0-7]{6})', chunk, re.M)[1], 8)

    returned = read('R0')
    order = 0 if returned == 0 else -1 if returned >= 32768 else 1
    rows.append(list(left + right) + [order, read('PSW'), read('R1')])
metadata = {
    'schemaVersion': 1,
    'source': 'docs/rsts-v4a-build.json',
    'captureScript': 'scripts/research/capture-ma2-comparisons.py',
    'loaderSha256': loader_hash,
    'simulatorCommit': '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6',
    'entryOctal': '102264',
    'completionOctal': '140100',
    'instructionBoundPerCall': 1000,
    'captureSha256': hashlib.sha256(out.encode()).hexdigest(),
    'captureNormalization': 'SIMH stdout with universal newlines and temporary configuration pathname replaced by <capture.ini>',
    'columns': ['leftHigh', 'leftLow', 'rightHigh', 'rightLow', 'orderFromSignedR0', 'PSW', 'returnedR1'],
    'counts': {str(order): sum(r[4] == order for r in rows) for order in [-1, 0, 1]},
    'rows': rows,
}
args.output.write_text(json.dumps(metadata, indent=2) + '\n')
print('Captured', len(rows), 'completed original CMPF calls:', metadata['counts'])
