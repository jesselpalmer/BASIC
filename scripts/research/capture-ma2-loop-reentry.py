"""Capture BASIC-PLUS loop-header state on rebuilt V4A-12 and archived V04B-17."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


PROBES = {
    'STALE': [
        '10 FOR I=1 TO 10', '20 IF C=0 THEN 50', '30 PRINT "OLD";I', '40 GOTO 90',
        '45 NEXT I', '47 GOTO 90', '50 FOR I=2 TO 3', '60 PRINT "NEW";I',
        '70 NEXT I', '75 C=1', '80 GOTO 45', '90 END',
    ],
    'POST': [
        '10 FOR I=1 TO 2', '20 PRINT I', '30 NEXT I', '40 IF C=1 THEN 90',
        '50 C=1:I=0:GOTO 30', '90 END',
    ],
    'UNSEEN': [
        '10 GOTO 30', '20 FOR I=1 TO 2', '30 PRINT "BODY"', '40 NEXT I', '50 END',
    ],
    'PRUNED': [
        '10 FOR I=1 TO 2', '20 FOR J=1 TO 2', '30 GOTO 60', '40 NEXT J',
        '50 NEXT I', '55 GOTO 100', '60 FOR I=3 TO 3', '70 PRINT "NEW";I',
        '80 NEXT I', '90 GOTO 40', '100 END',
    ],
    'SKIP': [
        '10 FOR I=3 TO 1', '20 PRINT I', '30 NEXT I', '40 C=C+1',
        '50 IF C=2 THEN 90', '60 I=0:GOTO 30', '90 END',
    ],
    'DESC': [
        '10 FOR I=2 TO 1 STEP -1', '20 PRINT I', '30 NEXT I',
        '40 IF C=1 THEN 90', '50 C=1:I=3:GOTO 30', '90 END',
    ],
}


def capture(simulator, disk, system, directory):
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    module = 'capture-life2-rsts.py' if system == 'v4a' else 'capture-nicoma-rsts.py'
    monitor = runpy.run_path(str(directory / module))
    enter, ready = terminal['enter'], terminal['READY']
    cases = []
    with tempfile.TemporaryDirectory(prefix='ma2-loop-reentry-') as scratch:
        path = Path(scratch)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(terminal['BOOT'], encoding='ascii')
        console = pexpect.spawn(
            str(simulator.resolve()), ['boot.ini'], cwd=scratch, encoding='ascii', timeout=20,
        )
        try:
            monitor['boot'](console)
            for name, source in PROBES.items():
                enter(console, 'NEW ' + name)
                console.expect_exact(ready)
                for line in source:
                    enter(console, line)
                    assert not console.before.strip(), (name, line, console.before)
                enter(console, 'RUN')
                console.expect(re.compile(name + r' +[^\r\n]*\r\n'))
                console.expect_exact(ready)
                # The monitor prints one extra blank line before Ready.
                output = console.before.replace('\r\n', '\n')
                assert output.endswith('\n\n'), repr(output)
                cases.append({'name': name, 'source': source, 'output': output[:-1]})
        finally:
            console.close(force=True)
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--v4b-disk', required=True, type=Path)
    parser.add_argument('--v4a-disk', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    digest = v4a['digest']
    assert digest(args.v4b_disk.read_bytes()) == '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
    cases = capture(args.simulator, args.v4b_disk, 'v4b', directory)
    systems = ['RSTS V04B-17 RSTSV4B']
    if args.v4a_disk:
        assert capture(args.simulator, args.v4a_disk, 'v4a', directory) == cases
        systems.insert(0, v4a['BUILD'])
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'], 'systems': systems, 'probes': cases,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
