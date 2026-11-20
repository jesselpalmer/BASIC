"""Capture bounded MA2 DATA/READ/RESTORE and caller failure cursor facts."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

PROBES = {
    'ORDER': ['10 READ I,A(I),J,A(J)', '20 PRINT I;A(2);J;A(1)',
              '30 END', '40 DATA 2,7,1,9'],
    'MIXED': ['10 READ A$,B,C$(1),D$', '20 PRINT "[";A$;"]";B;"[";C$(1);"][";D$;"]"',
              '30 END', '40 DATA  - 1 , + 2 ,"A, B",""'],
    'RESTORE': ['80 DATA 8', '10 GOTO 30', '20 DATA 2', '30 READ A,B',
                '40 PRINT A;B', '50 RESTORE', '60 READ C', '70 PRINT C', '90 END'],
    'DECIMAL': ['10 READ A,B', '20 PRINT INT((A-1)*16777216);INT((B+1)*16777216)',
                '30 END', '40 DATA 1.0000001,-1.0000001'],
    'ARRAY': ['10 DIM A$(1,1)', '20 READ A$(.9,1.9),B$(10)',
              '30 PRINT A$(0,1);":";B$(10)', '40 RESTORE', '50 READ C$',
              '60 PRINT C$', '70 END', '80 DATA "FIRST","SECOND"'],
    'PARTIAL': ['10 ON ERROR GOTO 90', '20 DIM A(0)', '30 DATA 7,8,9',
                '40 READ I,A(1),J', '50 END', '90 PRINT ERR;I;J', '100 READ S$',
                '110 PRINT S$', '120 END'],
    'QUOTED': ['10 ON ERROR GOTO 90', '20 A=7', '30 DATA "1",2', '40 READ A',
               '50 END', '90 PRINT ERR;A', '100 READ S$', '110 PRINT S$', '120 END'],
    'EMPTY': ['10 READ A', '20 END'],
}


def capture(simulator, disk, system, directory):
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    monitor = runpy.run_path(str(directory / (
        'capture-life2-rsts.py' if system == 'v4a' else 'capture-nicoma-rsts.py')))
    enter, ready = terminal['enter'], terminal['READY']
    cases = []
    with tempfile.TemporaryDirectory(prefix='ma2-data-') as scratch:
        path = Path(scratch)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(terminal['BOOT'], encoding='ascii')
        console = pexpect.spawn(str(simulator.resolve()), ['boot.ini'], cwd=scratch,
                                encoding='ascii', timeout=20)
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
                output = console.before.replace('\r\n', '\n')
                assert output.endswith('\n'), repr(output)
                cases.append({'name': name, 'source': source, 'output': output[:-1]})
        finally:
            console.close(force=True)
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--v4a-disk', required=True, type=Path)
    parser.add_argument('--v4b-disk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    digest = v4a['digest']
    assert digest(args.v4b_disk.read_bytes()) == '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
    cases = capture(args.simulator, args.v4a_disk, 'v4a', directory)
    other = capture(args.simulator, args.v4b_disk, 'v4b', directory)
    differences = [b for a, b in zip(cases, other) if a != b]
    assert differences == [{**next(case for case in cases if case['name'] == 'QUOTED'),
                            'output': ' 50  7 \n1\n'}], differences
    assert next(case for case in cases if case['name'] == 'QUOTED')['output'] == ' 52  7 \n1\n'
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'],
        'systems': [v4a['BUILD'], 'RSTS V04B-17 RSTSV4B'],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()),
        'v4bDiskSha256': digest(args.v4b_disk.read_bytes()),
        'probes': cases,
        'v4bDifferences': differences,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
