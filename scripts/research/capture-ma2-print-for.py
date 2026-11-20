"""Capture BASIC-PLUS PRINT FOR modifiers on rebuilt V4A-12 and archived V04B-17."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


PROBES = {
    'ASC': ['10 PRINT I;FOR I=1 TO 3', '20 PRINT "END";I', '30 END'],
    'EMPTY': ['10 PRINT "BODY";FOR I=3 TO 1', '20 PRINT "END";I', '30 END'],
    'DESC': ['10 PRINT I;FOR I=3 TO 1 STEP -1', '20 PRINT "END";I', '30 END'],
    'COLON': ['10 PRINT I;FOR I=1 TO 2:PRINT "AFTER"', '20 END'],
    'NEST': ['10 FOR J=1 TO 2', '20 PRINT J;I;FOR I=1 TO 2', '30 NEXT J', '40 END'],
    'JUMP': ['10 GOTO 30', '20 END', '30 PRINT I;FOR I=1 TO 2', '40 END'],
    'BOUND': ['10 N=3', '20 PRINT I;N;FOR I=1 TO N', '30 END'],
    'NORMAL': ['10 I=3', '20 FOR I=1 TO I+2', '30 PRINT I;', '40 NEXT I', '50 END'],
    'STEP': ['10 I=4', '20 PRINT I;FOR I=1 TO 3 STEP I', '30 END'],
    'ORDER': ['10 I=3', '20 PRINT I;FOR I=1 TO I+2', '30 END'],
    'GOTO': ['10 GO TO 30', '20 END', '30 PRINT I;FOR I=1 TO 2', '40 IF I=2 GO TO 60', '50 PRINT \"WRONG\"', '60 END'],
    'AMP': ['10&"A";FOR I=1 TO 2', '20 &"B"', '30 END'],
}


def capture(simulator, disk, system, directory):
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    module = 'capture-life2-rsts.py' if system == 'v4a' else 'capture-nicoma-rsts.py'
    monitor = runpy.run_path(str(directory / module))
    enter, ready = terminal['enter'], terminal['READY']
    cases = []
    with tempfile.TemporaryDirectory(prefix='ma2-print-for-') as scratch:
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
                assert output.endswith('\n'), repr(output)
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
