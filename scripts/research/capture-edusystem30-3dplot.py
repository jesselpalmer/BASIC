"""Capture the pinned 3DPLOT listing and DEF behavior on archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '37a24eff0b3ff254479d22e0318800342d4a19deecfd8c46ee6c9f108a95d01a'
PROBES = [
    (
        'forward and skipped definition',
        ['10 Z=9', '20 B=4', '30 PRINT FNA(3);Z', '40 GOTO 60',
         '50 DEF FNA(Z)=Z+B', '60 B=8', '70 PRINT FNA(3);Z', '80 END'],
        ' 7  9 \n 11  9 \n',
    ),
    (
        'last numbered definition',
        ['20 DEF FNA(Z)=Z+2', '10 DEF FNA(Z)=Z+1', '30 PRINT FNA(5)', '40 END'],
        ' 7 \n',
    ),
    (
        'nested formal shadows a global in the callee',
        ['10 DEF FNA(Z)=Z+B', '20 DEF FNB(B)=FNA(B+1)+B',
         '30 Z=8\\B=7', '40 PRINT FNB(2);B;Z', '50 END'],
        ' 7  7  8 \n',
    ),
    (
        'argument evaluated before binding',
        ['10 DEF FNB(A1)=A1+1', '20 A1=7', '30 PRINT FNB(A1+1);A1', '40 END'],
        ' 9  7 \n',
    ),
    (
        'recursive call exhausts the archive stack',
        ['10 DEF FNA(Z)=FNA(Z)+1', '20 PRINT FNA(1)', '30 END'],
        '\nERROR SP AT LINE 0020\n',
    ),
]


def capture(console, shared, source):
    for line in source:
        shared['send_line'](console, line)


def run(console, shared):
    shared['send_line'](console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('READY')
    output = console.before.replace('\r\n', '\n')
    assert output.endswith('\n\0\n'), repr(output)
    # Strip the READY prompt's leading NUL and line break.
    return output[:-2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    sim = args.simulator.resolve()
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixture = Path(__file__).resolve().parents[1] / 'package/fixtures/classic/3dplot.bas'
    source = fixture.read_bytes()
    assert shared['digest'](source) == SOURCE_SHA256

    with shared['edu30'](sim, tape) as console:
        capture(console, shared, source.decode('ascii').splitlines())
        plot = run(console, shared)
        assert run(console, shared) == plot
    rows = plot.splitlines()
    assert rows[0] == ''
    rows = rows[1:]
    assert len(rows) == 41
    assert rows == rows[::-1]
    assert all(re.fullmatch(r'[ *]+', row) and row.endswith('*') for row in rows)

    probes = []
    for name, lines, expected in PROBES:
        with shared['edu30'](sim, tape) as console:
            capture(console, shared, lines)
            output = run(console, shared)
        assert output == expected, (name, repr(output))
        probes.append({'name': name, 'source': '\n'.join(lines), 'output': output})

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'outputSha256': shared['digest'](plot.encode('ascii')),
        'rowCount': len(rows),
        'rows': rows,
        'functionProbes': probes,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
