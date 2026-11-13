"""Capture FOR restart and same-name loop behavior on RSTS V4A-12 MA2."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


PROBES = {
    'SAME': [
        '10 C=C+1', '20 FOR I=1 TO 2', '30 PRINT I;C',
        '40 IF C<2 THEN 10', '50 NEXT I', '60 END',
    ],
    'NEST': [
        '10 FOR I=1 TO 2', '20 FOR I=3 TO 4', '30 PRINT I',
        '40 NEXT I', '50 NEXT I', '60 END',
    ],
    'PRUNE': [
        '10 C=C+1', '20 FOR I=1 TO 2', '30 FOR J=1 TO 2',
        '40 IF C<2 THEN 10', '50 PRINT I;J', '60 NEXT J', '70 NEXT I', '80 END',
    ],
    'OTHER': [
        '10 FOR I=1 TO 2', '20 IF C=0 THEN 50', '30 NEXT I', '40 GOTO 90',
        '50 FOR I=3 TO 4', '60 PRINT I', '70 NEXT I', '75 C=1', '80 GOTO 30', '90 END',
    ],
    'EXITS': [
        '10 C=C+1', '20 FOR I=1 TO 2', '30 FOR J=1 TO 2', '40 IF C=1 THEN 10',
        '50 IF C=2 THEN 70', '60 NEXT J', '70 PRINT I;J', '80 NEXT I', '90 END',
    ],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--disk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    enter = terminal['enter']
    ready = terminal['READY']
    probes = []
    with tempfile.TemporaryDirectory(prefix='ma2-for-restart-') as scratch:
        path = Path(scratch)
        shutil.copyfile(args.disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(terminal['BOOT'], encoding='ascii')
        console = pexpect.spawn(
            str(args.simulator.resolve()), ['boot.ini'], cwd=scratch, encoding='ascii', timeout=20,
        )
        try:
            v4a['boot'](console)
            for name, source in PROBES.items():
                enter(console, 'NEW ' + name)
                console.expect_exact(ready)
                for line in source:
                    enter(console, line)
                    assert not console.before.strip(), (name, line, console.before)
                enter(console, 'RUN')
                console.expect(re.compile(name + r' +[^\r\n]*\r\n'))
                console.expect_exact(ready)
                probes.append({
                    'name': name, 'source': source, 'output': console.before.replace('\r\n', '\n'),
                })
        finally:
            console.close(force=True)
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'], 'build': v4a['BUILD'], 'probes': probes,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
