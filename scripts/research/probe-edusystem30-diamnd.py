"""Check the reviewed DIAMND listing and a loop probe on archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '15ec624beae75585d8881fdb08607aa52bf6ac27ee671c8f093f0959d412ba5a'
LOOP_PROBE_LINES = [
    '7 PRINT "Q";Q; "R";R',
    '9 PRINT "L";L',
    '21 PRINT "N";N',
    '27 PRINT "A"',
    '57 PRINT "M";M',
    '61 PRINT "PRINTED"',
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    normalize, send_line = shared['normalize'], shared['send_line']
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    root = Path(__file__).resolve().parents[2]
    fixture = (root / 'scripts/package/fixtures/classic/diamnd-mar75-text.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256

    def run(console, size):
        send_line(console, 'RUN')
        console.expect_exact('?')
        send_line(console, str(size))
        console.expect_exact('READY')
        return normalize(console.before)

    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            send_line(console, line)
        after_response = {size: run(console, size) for size in (5, 15, 31)}
        assert all(output == '\n\n' for output in after_response.values()), after_response

        for line in LOOP_PROBE_LINES:
            send_line(console, line)
        output = run(console, 31)
        row_widths = [int(match) for match in re.findall(r'^N (\d+) $', output, re.M)]
        assert row_widths == list(range(1, 32, 2)) + list(range(29, 0, -2)), repr(output)
        assert '\nDEC' + '!' * 28 + '\nPRINTED\n' in output, repr(output)

    print(json.dumps({
        'fixtureSha256': SOURCE_SHA256,
        'reviewedOutputAfterInput': after_response,
        'instrumentedSize31RowWidths': row_widths,
    }, indent=2))


if __name__ == '__main__':
    main()
