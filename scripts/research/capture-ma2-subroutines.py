"""Capture BASIC-PLUS literal GOSUB/RETURN and lexical FOR state on rebuilt V4A-12 and archived V04B-17."""

import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


PROBES = {'NEST': ['10 N=1:GOSUB 100:PRINT "MAIN";N:END',
          '100 N=N+2:GOSUB 200:N=N+1:RETURN',
          '200 N=N*3:RETURN'],
 'FORCALL': ['10 FOR J=1 TO 2',
             '20 GOSUB 100',
             '30 PRINT "BACK";I;J',
             '40 NEXT J',
             '50 END',
             '100 FOR I=1 TO 3',
             '110 PRINT "SUB";I;J',
             '120 RETURN',
             '130 NEXT I',
             '140 RETURN'],
 'PERSIST': ['10 C=0:GOSUB 100',
             '20 I=0:C=1',
             '30 GOTO 120',
             '40 END',
             '100 FOR I=1 TO 2',
             '110 IF C=0 THEN 150',
             '120 PRINT I;',
             '130 NEXT I',
             '140 END',
             '150 RETURN'],
 'CROSS': ['10 FOR I=1 TO 2',
           '20 GOSUB 100',
           '30 PRINT "BACK";I',
           '40 NEXT I',
           '50 END',
           '100 PRINT "SUB";I',
           '110 GOTO 40',
           '120 RETURN'],
 'UNINIT': ['10 GOSUB 110',
            '20 PRINT "AFTER";I',
            '30 END',
            '100 FOR I=1 TO 2',
            '110 PRINT "BODY";I',
            '120 NEXT I',
            '130 RETURN'],
 'SAMEVAR': ['10 N=0:FOR I=1 TO 2',
             '20 GOSUB 100',
             '30 N=N+1:PRINT "BACK";I',
             '35 IF N=2 THEN 50',
             '40 NEXT I',
             '50 END',
             '100 FOR I=1 TO 1',
             '110 PRINT "SUB";I',
             '120 NEXT I',
             '130 RETURN'],
 'CHECKR': ['10 FOR X=1 TO 3',
            '20 FOR Y=1 TO 3',
            '30 GOSUB 100',
            '40 PRINT X;Y',
            '50 NEXT Y',
            '60 NEXT X',
            '70 END',
            '100 FOR X=8 TO 8',
            '110 FOR Y=8 TO 8',
            '120 RETURN',
            '130 NEXT Y',
            '140 NEXT X',
            '150 RETURN'],
 'RECURSE': ['10 N=0:GOSUB 100:PRINT "MAIN";N:END',
             '100 N=N+1:PRINT "SUB";N',
             '110 IF N=3 THEN 130',
             '120 GOSUB 100',
             '130 RETURN'],
 'NOCLL': ['10 RETURN', '20 END'],
 'UNSEEN': ['10 I=0:GOTO 110',
            '100 FOR I=1 TO 2',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNSET5': ['10 I=5:GOTO 110',
            '100 FOR I=1 TO 2',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNSETN': ['10 I=-5:GOTO 110',
            '100 FOR I=1 TO 2',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNSTEP': ['10 I=0:GOTO 110',
            '100 FOR I=1 TO 2 STEP 2',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNSDES': ['10 I=0:GOTO 110',
            '100 FOR I=1 TO 2 STEP -2',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNEXP1': ['10 I=5:GOTO 110',
            '100 FOR I=1 TO 2 STEP 1',
            '110 PRINT "BEFORE";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 END'],
 'UNPOST': ['10 I=5:C=0:GOTO 120',
            '100 FOR I=10 TO 20',
            '110 PRINT "BODY";I',
            '120 NEXT I',
            '130 PRINT "AFTER";I',
            '140 C=C+1',
            '150 IF C=1 THEN 120',
            '160 END'],
 'UNRES': ['10 I=5:C=0:GOTO 120',
           '100 FOR I=10 TO 20',
           '110 PRINT "BODY";I',
           '120 NEXT I',
           '130 PRINT "AFTER";I',
           '140 IF C=1 THEN 180',
           '150 C=1:I=-2',
           '160 GOTO 120',
           '180 END']}


def capture(simulator, disk, system, directory):
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    module = 'capture-life2-rsts.py' if system == 'v4a' else 'capture-nicoma-rsts.py'
    monitor = runpy.run_path(str(directory / module))
    enter, ready = terminal['enter'], terminal['READY']
    cases = []
    with tempfile.TemporaryDirectory(prefix='ma2-subroutines-') as scratch:
        path = Path(scratch)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(terminal['BOOT'], encoding='ascii')
        console = pexpect.spawn(
            str(simulator.resolve()), ['boot.ini'], cwd=scratch, encoding='ascii', timeout=20,
        )
        try:
            monitor['boot'](console)
            for name, source in PROBES.items():
                enter(console, 'NEW ' + name[:6])
                console.expect_exact(ready)
                for line in source:
                    enter(console, line)
                    assert not console.before.strip(), (name, line, console.before)
                enter(console, 'RUN')
                console.expect(re.compile(name[:6] + r' +[^\r\n]*\r\n'))
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
