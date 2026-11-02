"""Capture the pinned MA2 ATOF routine for complete unsigned source spellings.

Obtain the simulator and loader separately; normal checks use only offline JSON.
See docs/basic-plus-ma2-decimal.md. No arithmetic model computes result words.
"""

from pathlib import Path
import tempfile, subprocess, json, re, hashlib, argparse

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
cases = list(
    dict.fromkeys(
        [str(i) for i in range(65)]
        + [
            ".0",
            "0.",
            "00",
            "000.000",
            ".1",
            ".01",
            ".00000001",
            "1.0000001",
            "1.0000002",
            "1.00000011920928955078125",
            "1.000000059604644775390625",
            "1.000000178813934326171875",
            "16777215.",
            "16777216.",
            "16777217.",
            "16777218.",
            "16777219.",
            "123456789",
            "123456789.",
            "1234567.890123",
            "123456.7890123",
            ".1234567890123",
        ]
        + [
            f"{m}E{e:+}"
            for m in ["0", "1", "9.999999", "1234567", "9999999", "0.0000001"]
            for e in [
                -32769,
                -32768,
                -32767,
                -999,
                -40,
                -39,
                -38,
                -37,
                -1,
                0,
                1,
                37,
                38,
                39,
                40,
                999,
                32767,
                32768,
            ]
        ]
    )
)
# Decimal cutoff, leading-fraction zeros and word-exponent addition boundaries.
for zeros in [0, 1, 6, 7, 8, 16, 40]:
    for tail in ["0", "1", "12345678901234567890"]:
        for exponent in ["", "E-32768", "E+32767", "E-38", "E+38"]:
            cases.append("." + "0" * zeros + tail + exponent)
seed = 20261103


def rand():
    global seed
    seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
    return seed


for _ in range(96):
    before = "".join(str(rand() % 10) for _ in range(rand() % 13))
    after = "".join(str(rand() % 10) for _ in range(1 + rand() % 20))
    exponent = int(rand() % 85) - 42
    cases.append(before + "." + after + f"E{exponent:+}")
cases += ["9" * 40, "9" * 40 + "E+32768", "0" * 254, "0." + "0" * 252 + "1"]
cases = list(dict.fromkeys(cases))
lines = [
    "SET CPU 11/05",
    "SET CPU 64K",
    f'LOAD "{loader}"',
    "DEPOSIT 4064 140020",
    "BREAK 77314",
    "EXAMINE 77316-77374",
]
for i, s in enumerate(cases):
    data = s.encode() + b"\0"
    data += b"\0" * (len(data) % 2)
    lines += (
        [f"ECHO CASE {i}"]
        + [
            f'DEPOSIT {0o140040+j:o} {int.from_bytes(data[j:j+2],"little"):o}'
            for j in range(0, len(data), 2)
        ]
        + [
            "DEPOSIT 140020 0",
            "DEPOSIT R1 140010",
            "DEPOSIT R2 140040",
            "DEPOSIT R0 0",
            "DEPOSIT R3 0",
            "DEPOSIT R4 0",
            "DEPOSIT R5 0",
            "DEPOSIT SP 150000",
            "DEPOSIT PSW 0",
            "DEPOSIT PC 76624",
            "SET CPU HISTORY=0",
            "SET CPU HISTORY=100000",
            "STEP 200000",
            "EXAMINE R1",
            "EXAMINE R2",
            "EXAMINE R4",
            "EXAMINE PSW",
            "EXAMINE 140004",
            "EXAMINE 140006",
            "EXAMINE 140020",
            "SHOW CPU HISTORY",
        ]
    )
lines += ["QUIT"]
with tempfile.TemporaryDirectory() as d:
    script = Path(d) / "capture.ini"
    script.write_text("\n".join(lines) + "\n")
    out = subprocess.run(
        [str(sim), str(script)], capture_output=True, text=True, check=True, timeout=120
    ).stdout
out = re.sub(r"^.*?capture\.ini-(\d+)>", r"<capture.ini>-\1>", out, flags=re.M)
assert "698dc8a1" in out
chunks = re.split(r"^CASE \d+\s*$", out, flags=re.M)[1:]
assert len(chunks) == len(cases)
rows = []
for s, c in zip(cases, chunks):

    def read(k):
        return int(re.search(r"^" + k + r":\s+([0-7]{6})", c, re.M)[1], 8)

    assert "Breakpoint, PC: 077314" in c, c[-1200:]
    hist = re.findall(r"^([0-7]{6}) [0-7]{6} [0-7]{6}\|", c, re.M)
    assert hist[0] == "076624" and len(hist) < 100000, c[-1500:]
    rows.append(
        [
            s,
            read("140004"),
            read("140006"),
            read("R4"),
            read("PSW"),
            read("140020"),
            read("R2") - 0o140040,
            len(hist),
        ]
    )
metadata = {
    "schemaVersion": 1,
    "source": "docs/rsts-v4a-build.json",
    "captureScript": "scripts/research/capture-ma2-decimal.py",
    "loaderSha256": hashlib.sha256(loader.read_bytes()).hexdigest(),
    "simulatorCommit": "698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6",
    "entryOctal": "076624",
    "completionOctal": "077314",
    "statusLatchOctal": "140020",
    "historyCapacity": 100000,
    "instructionBoundPerCall": 200000,
    "maxHistoryEntries": max(r[7] for r in rows),
    "captureSha256": hashlib.sha256(out.encode()).hexdigest(),
    "captureNormalization": "SIMH stdout with universal newlines and temporary configuration pathname replaced by <capture.ini>",
    "columns": [
        "spelling",
        "resultHigh",
        "resultLow",
        "R4",
        "PSW",
        "statusMask",
        "consumedAsciiBytes",
        "historyEntries",
    ],
    "selection": "0..64; decimal/24-bit neighbors; six mantissas across signed-word/scale exponent endpoints; leading-fraction-zero/cutoff families; 96 LCG spellings, seed20261103, multiplier1664525, increment1013904223, modulus2^32; 40-digit integer/event and long zero/cutoff controls; deduplicate first occurrence",
    "counts": {
        "value": sum(not (r[4] & 2) and not r[5] for r in rows),
        "conversion-status": sum(bool(r[4] & 2) and not r[5] for r in rows),
        "numeric-event": sum(bool(r[5]) for r in rows),
    },
    "calls": len(rows),
    "powerTableWords": [
        int(v, 8)
        for v in re.findall(r"^77[0-7]{3}:\s+([0-7]{6})", out.split("CASE 0")[0], re.M)
    ],
}
assert len(metadata["powerTableWords"]) == 24
text = (
    json.dumps(metadata, indent=2)[:-2]
    + ',\n  "rows": [\n'
    + ",\n".join("    " + json.dumps(r) for r in rows)
    + "\n  ]\n}\n"
)
args.output.write_text(text)
print("Captured", len(rows), "original ATOF calls:", metadata["counts"])
