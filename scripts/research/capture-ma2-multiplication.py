"""Capture original V4A MA2 words; no emulator or historical binary is bundled.

python scripts/research/capture-ma2-multiplication.py --simulator /path/to/pdp11 \
    --loader /path/to/SY.LDA --output /path/to/reference.json

See docs/basic-plus-ma2-multiplication.md. Standard library only. This is an
explicit research command, never a normal CI dependency or a TypeScript oracle
calculated by the implementation being tested.
"""

from pathlib import Path
import argparse
import subprocess
import tempfile
import re
import json
import hashlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--simulator", type=Path, required=True)
parser.add_argument("--loader", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
sim = args.simulator.resolve()
loader = args.loader.resolve()
if any(c in str(loader) for c in '\r\n"'):
    raise ValueError("Loader pathname contains a SIMH command delimiter")
if (
    hashlib.sha256(loader.read_bytes()).hexdigest()
    != "e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596"
):
    raise ValueError("Loader does not match the pinned V4A MA2 build")


def words(sign, sig, exp):
    return [(0x8000 if sign < 0 else 0) + exp * 128 + (sig >> 16) - 128, sig & 65535]


cases = []


def case(l, r):
    if (l, r) not in cases:
        cases.append((l, r))


one = words(1, 1 << 23, 129)
zero = [0, 0]
# Exact, adjacent, normalization threshold, halfway and rounding-carry neighbors.
sigs = [
    1 << 23,
    (1 << 23) + 1,
    (1 << 23) + 2,
    (1 << 23) + 3,
    0xB504F2,
    0xB504F3,
    0xB504F4,
    0xC00000,
    0xFFFFFD,
    0xFFFFFE,
    0xFFFFFF,
]
for a in sigs:
    for b in sigs:
        for s, t in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
            case(words(s, a, 129), words(t, b, 129))
# Exponent sum boundaries and extreme low/high fractions; both normalization paths.
for el, er in [
    (1, 1),
    (1, 127),
    (1, 128),
    (1, 129),
    (1, 130),
    (1, 255),
    (127, 1),
    (128, 1),
    (129, 1),
    (130, 1),
    (255, 1),
    (127, 128),
    (128, 128),
    (128, 129),
    (129, 254),
    (129, 255),
    (130, 255),
    (254, 129),
    (255, 129),
    (255, 130),
    (255, 255),
]:
    for a, b in [
        (1 << 23, 1 << 23),
        (1 << 23, 0xFFFFFF),
        (0xB504F3, 0xB504F4),
        (0xFFFFFF, 0xFFFFFF),
    ]:
        for s, t in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
            case(words(s, a, el), words(t, b, er))
for w in [
    zero,
    one,
    words(-1, 1 << 23, 129),
    words(1, 1 << 23, 1),
    words(-1, 0xFFFFFF, 255),
]:
    case(zero, w)
    case(w, zero)
seed = 20261102


def rand():
    global seed
    seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
    return seed


for i in range(256):
    a = words(-1 if rand() & 1 else 1, 0x800000 | (rand() & 0x7FFFFF), 1 + rand() % 255)
    b = words(-1 if rand() & 1 else 1, 0x800000 | (rand() & 0x7FFFFF), 1 + rand() % 255)
    case(a, b)
    case(b, a)


def capture(selected, continuations=False):
    lines = [
        "SET CPU 11/05",
        "SET CPU 64K",
        f'LOAD "{loader}"',
        "DEPOSIT 4064 140020",
        "BREAK 101404",
    ]
    if not continuations:
        lines += ["BREAK 101420"]
    for i, (l, r) in enumerate(selected):
        if continuations:
            lines += ["SET CPU HISTORY=0", "SET CPU HISTORY=1000"]
        lines += (
            [f"ECHO CASE {i}"]
            + [f"DEPOSIT {0o140000+j*2:o} {v:o}" for j, v in enumerate(r + l)]
            + ["DEPOSIT 140010 0", "DEPOSIT 140020 0"]
            + [f"DEPOSIT R{j} {0o140000 if j==1 else 0:o}" for j in range(6)]
            + [
                "DEPOSIT SP 150000",
                "DEPOSIT PSW 0",
                "DEPOSIT PC 101170",
                "STEP 10000",
                "EXAMINE PC",
                "EXAMINE R4",
                "EXAMINE R1",
                "EXAMINE 140004",
                "EXAMINE 140006",
                "EXAMINE 140010",
                "EXAMINE 140020",
            ]
        )
        if continuations:
            lines += ["SHOW CPU HISTORY"]
    lines += ["QUIT"]
    with tempfile.TemporaryDirectory() as d:
        script = Path(d) / "capture.ini"
        script.write_text("\n".join(lines) + "\n")
        out = subprocess.run(
            [str(sim), str(script)],
            capture_output=True,
            text=True,
            timeout=120,
            check=True,
        ).stdout
    out = re.sub(r"^.*?capture\.ini-(\d+)>", r"<capture.ini>-\1>", out, flags=re.M)
    captures["continued" if continuations else "initial"] = hashlib.sha256(
        out.encode()
    ).hexdigest()
    assert "698dc8a1" in out
    chunks = re.split(r"^CASE \d+\s*$", out, flags=re.M)[1:]
    assert len(chunks) == len(selected), (len(chunks), len(selected))
    result = []
    for c in chunks:

        def read(name):
            m = re.search("^" + name + r":\s+([0-7]{6})", c, re.M)
            assert m, (name, c)
            return int(m[1], 8)

        if continuations:
            pcs = re.findall(r"^([0-7]{6}) [0-7]{6} [0-7]{6}\|", c, re.M)
            assert pcs and pcs[0] == "101170" and len(pcs) < 1000, c
            assert pcs.count("101420") == 1 and "101422" not in pcs, c
            histories.append(len(pcs))
        pc = read("PC")
        assert pc in [0o101404, 0o101420], c
        e = read("R4")
        e = e if e < 32768 else e - 65536
        outcome = 0 if pc == 0o101404 else 2 if e < 1 else 1
        pointer = read("R1")
        assert pointer in [0o140004, 0o140006], c
        result.append(
            [
                outcome,
                read(f"{pointer:o}"),
                read(f"{pointer+2:o}"),
                read("140020"),
                pointer,
            ]
        )
    return result


captures = {}
histories = []
raw = capture(cases)
trapcases = [c for c, r in zip(cases, raw) if r[0]]
completed = capture(trapcases, True)
ci = iter(completed)
rows = []
for (l, r), res in zip(cases, raw):
    outcome = res[0]
    if outcome:
        continued = next(ci)
        assert continued[0] == 0 and continued[3] == 0o100002, continued
        res = continued
    else:
        assert res[3] == 0
    rows.append(l + r + [outcome] + res[1:3] + [res[4], res[3]])
metadata = {
    "schemaVersion": 1,
    "source": "docs/rsts-v4a-build.json",
    "captureScript": "scripts/research/capture-ma2-multiplication.py",
    "loaderSha256": hashlib.sha256(loader.read_bytes()).hexdigest(),
    "simulatorCommit": "698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6",
    "entryOctal": "101170",
    "completionOctal": "101404",
    "trapOctal": "101420",
    "inlineMaskOctal": "100002",
    "statusLatchOctal": "140020",
    "instructionBoundPerCall": 10000,
    "rangeHistoryCapacity": 1000,
    "maxRangeHistoryEntries": max(histories),
    "captureSha256": captures,
    "captureNormalization": "SIMH stdout with universal newlines and temporary configuration pathname replaced by <capture.ini>",
    "columns": [
        "leftHigh",
        "leftLow",
        "rightHigh",
        "rightLow",
        "outcome0Value1Overflow2Underflow",
        "resultOrContinuationHigh",
        "resultOrContinuationLow",
        "returnedR1",
        "statusMask",
    ],
    "selection": {
        "significands": sigs,
        "signPairs": [[1, 1], [-1, 1], [1, -1], [-1, -1]],
        "endpointExponents": [
            [1, 1],
            [1, 127],
            [1, 128],
            [1, 129],
            [1, 130],
            [1, 255],
            [127, 1],
            [128, 1],
            [129, 1],
            [130, 1],
            [255, 1],
            [127, 128],
            [128, 128],
            [128, 129],
            [129, 254],
            [129, 255],
            [130, 255],
            [254, 129],
            [255, 129],
            [255, 130],
            [255, 255],
        ],
        "randomPairs": 256,
        "seed": 20261102,
        "multiplier": 1664525,
        "increment": 1013904223,
        "modulus": 2**32,
        "deduplication": "First occurrence of each ordered word-pair tuple; explicit endpoints/signs/zeros then each LCG pair and its reverse.",
    },
    "counts": {str(i): sum(r[4] == i for r in rows) for i in range(3)},
    "calls": len(rows),
    "continuedRangeCalls": len(completed),
}
text = (
    json.dumps(metadata, indent=2)[:-2]
    + ',\n  "rows": [\n'
    + ",\n".join("    " + json.dumps(r) for r in rows)
    + "\n  ]\n}\n"
)
args.output.write_text(text)
print(
    f'Captured {len(rows)} original-machine results: {metadata["counts"]}; {len(completed)} real-handler range continuations.'
)
