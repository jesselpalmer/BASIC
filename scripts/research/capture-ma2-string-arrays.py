"""Capture string array defaults and indexing on archived BASIC-PLUS builds.

Only temporary disk copies are changed. Requires pexpect and the reference disks
identified in docs/rsts-v4a-build.md and docs/nicoma-source-review.md.
"""

import argparse
import hashlib
from importlib import import_module
import json
from pathlib import Path
import shutil
import tempfile

import pexpect

fipfop = import_module('capture-fipfop-rsts')
life2 = import_module('capture-life2-rsts')
nicoma = import_module('capture-nicoma-rsts')

CASES = {
    'defaults': {
        'source': ['10 DIM A$(2)', '20 PRINT "[";A$(0);A$(2);"]"',
                   '30 A$="SCALAR"', '40 A$(1)="LONGER THAN DIM"',
                   '50 PRINT A$;":";A$(1)', '60 END'],
        'output': '[]\nSCALAR:LONGER THAN DIM\n\n',
    },
    'implicit': {
        'source': ['10 PRINT "[";A$(10);"]"', '20 A$(10)="TEN"',
                   '30 PRINT A$(10)', '40 PRINT A$(11)', '50 END'],
        'output': '[]\nTEN\nSUBSCRIPT OUT OF RANGE at line 40 \n\n',
    },
    'rankTwoTruncation': {
        'source': ['10 DIM A$(1,2)', '20 A$(.9,1.9)="ONE"',
                   '30 A$(-.9,2.9)="TWO"', '40 PRINT A$(0,1);":";A$(0,2)',
                   '50 PRINT A$(1,0)', '60 END'],
        'output': 'ONE:TWO\n\n\n',
    },
    'laterDim': {
        'source': ['10 A$(12)="TWELVE"', '20 DIM A$(12)',
                   '30 PRINT A$(12)', '40 END'],
        'output': 'TWELVE\n\n',
    },
}


def capture(simulator, disk, boot):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copyfile(disk, root / 'working.dsk')
        (root / 'boot.ini').write_text(fipfop.BOOT, encoding='ascii')
        with pexpect.spawn(str(simulator), ['boot.ini'], cwd=directory,
                           encoding='ascii', timeout=20) as console:
            boot(console)
            for name, case in CASES.items():
                fipfop.enter(console, 'NEW FIPFOP')
                console.expect_exact(fipfop.READY)
                for line in case['source']:
                    fipfop.enter(console, line)
                    assert not console.before.strip(), (name, console.before)
                fipfop.enter(console, 'RUN')
                console.expect(r'FIPFOP +[^\r\n]*\r\n')
                console.expect_exact(fipfop.READY)
                assert console.before.replace('\r\n', '\n') == case['output'], (name, console.before)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--v4a-disk', type=Path, required=True)
    parser.add_argument('--v4b-disk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    builds = []
    for name, disk, boot in [('V4A-12 MA2', args.v4a_disk, life2.boot),
                             ('V04B-17', args.v4b_disk, nicoma.boot)]:
        capture(args.simulator.resolve(), disk.resolve(), boot)
        builds.append({'build': name, 'diskSha256': hashlib.sha256(disk.read_bytes()).hexdigest()})
    args.output.write_text(json.dumps({
        'simulatorCommit': life2.SIMH_COMMIT,
        'builds': builds,
        'cases': CASES,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
