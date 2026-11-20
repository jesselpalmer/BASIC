"""Capture numeric INPUT rows and partial state on both pinned RSTS builds.

Only temporary disk copies change. Input echo and monitor banners are excluded;
question-mark prompts and INPUT's retry diagnostic remain in the transcript.
"""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import sys
import tempfile

import pexpect

PROBES = {
    'plain': ['1,2'],
    'spaces': [' 3 , -4 '],
    'surplus': ['5,6,7'],
    'ignoredSurplusText': ['5,6,X'],
    'continuation': ['8', '9'],
    'invalidFirst': ['X,2', '3,4'],
    'invalidAfterPartial': ['5,X', '3,4'],
    'emptyFirst': [',2'],
    'emptyLast': ['1,'],
    'emptyLine': ['', '2'],
    'fraction': ['1.5,-2.5'],
    'exponent': ['1E2,2'],
    'quotedNumber': ['"1","2"', '3,4'],
}
SOURCE = ['10 X=91:Y=92', '20 INPUT "FROM";X,Y', '30 PRINT INT(X*2);INT(Y*2)', '40 END']


def capture(simulator, disk, system, directory):
    sys.path.insert(0, str(directory))
    terminal = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    monitor = runpy.run_path(str(directory / ('capture-life2-rsts.py' if system == 'v4a' else 'capture-nicoma-rsts.py')))
    enter, ready = terminal['enter'], terminal['READY']
    cases = []
    with tempfile.TemporaryDirectory(prefix='ma2-input-rows-') as scratch:
        path = Path(scratch)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(terminal['BOOT'], encoding='ascii')
        console = pexpect.spawn(str(simulator.resolve()), ['boot.ini'], cwd=scratch, encoding='ascii', timeout=20)
        try:
            monitor['boot'](console)
            for name, answers in list(PROBES.items()) + [('stoppedContinuation', ['8']), ('stoppedInvalidPartial', ['5,X'])]:
                enter(console, 'NEW INPUT')
                console.expect_exact(ready)
                for line in SOURCE:
                    enter(console, line)
                    assert not console.before.strip(), (name, line, console.before)
                enter(console, 'LIST')
                console.expect_exact(ready)
                start = re.search(r'INPUT +[^\r\n]*\r\n', console.before)
                assert start
                assert console.before[start.end():] == ''.join(line+'\r\n' for line in SOURCE)+'\r\n'
                enter(console, 'RUN')
                console.expect(r'INPUT +[^\r\n]*\r\n')
                chunks = []
                prompts = []
                for answer in answers:
                    console.expect_exact('? ')
                    text = console.before + console.after
                    chunks.append(text)
                    prompts.append('FROM' if text.endswith('FROM? ') else '')
                    enter(console, answer)
                row = {'name': name, 'source': SOURCE, 'responses': answers, 'prompts': prompts}
                if name.startswith('stopped'):
                    console.expect_exact('? ')
                    text = console.before + console.after
                    chunks.append(text)
                    row['pendingPrompt'] = 'FROM' if text.endswith('FROM? ') else ''
                    console.sendcontrol('c')
                    console.expect_exact(ready)
                    enter(console, 'PRINT X;Y')
                    console.expect_exact(ready)
                    observed = console.before.replace('\r\n', '\n')
                    assert observed.endswith('\n')
                    row['stoppedValuesOutput'] = observed[:-1]
                else:
                    console.expect_exact(ready)
                    text = console.before.replace('\r\n', '\n')
                    assert text.endswith('\n')
                    chunks.append(text[:-1])
                row['output'] = ''.join(chunks).replace('\r\n', '\n')
                cases.append(row)
        finally:
            console.close(force=True)
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--v4a-disk', type=Path, required=True)
    parser.add_argument('--v4b-disk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    sys.path.insert(0, str(directory))
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    digest = v4a['digest']
    assert digest(args.v4b_disk.read_bytes()) == '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
    cases = capture(args.simulator, args.v4a_disk, 'v4a', directory)
    other = capture(args.simulator, args.v4b_disk, 'v4b', directory)
    for left, right in zip(cases, other):
        normalized = dict(right)
        normalized['output'] = right['output'].replace('DATA FORMAT ERROR', 'ILLEGAL NUMBER')
        assert left == normalized, (left, right)
        if left['output'] != right['output']:
            left['v4bOutput'] = right['output']
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'],
        'systems': [v4a['BUILD'], 'RSTS V04B-17 RSTSV4B'],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()),
        'v4bDiskSha256': digest(args.v4b_disk.read_bytes()),
        'cases': cases,
    }, indent=2)+'\n', encoding='ascii')


if __name__ == '__main__':
    main()
