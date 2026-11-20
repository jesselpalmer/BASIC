"""Replay reviewed GUNNER and its lexical adaptation on stock V4A/V4B."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile
import math
import pexpect

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
PROMPT = 'ELEVATION:? '


def wrapped(line):
    result = ''
    column = 0
    for char in line:
        if column == 72 and char != '\x07':
            result += '\r\n'
            column = 0
        result += char
        if char != '\x07':
            column += 1
    return result


def capture(console, boot, shared, source, answers=None):
    boot(console)
    ready = shared['READY']

    def enter(console, line):
        console.send(line + '\r')
        console.expect_exact(wrapped(line) + '\r\n')
    enter(console, 'NEW GUNNER')
    console.expect_exact(ready)
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'GUNNER +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join(wrapped(line) + '\r\n'
                       for line in source)
    assert console.before[title.end():] == expected + '\r\n', repr(console.before)
    enter(console, 'RUN')
    console.expect(r'GUNNER +[^\r\n]*\r\n')
    console.expect_exact(PROMPT)
    output = console.before + console.after
    selected = []
    for index in range(15):
        if answers is not None:
            answer = answers[index]
        elif index == 0:
            answer = '0'
        elif index == 1:
            answer = '90'
        elif index == 2 or index >= 9:
            answer = '1'
        elif index == 3:
            answer = '45'
        else:
            target = int(re.findall(r'DISTANCE TO THE TARGET IS +(\d+)', output)[-1])
            answer = f'{math.asin(target/46500)*57.3/2:.8f}'
        selected.append(answer)
        enter(console, answer)
        console.expect_exact(PROMPT)
        output += console.before + console.after
    output = output.replace('\r\n', '\n')
    assert output.count('***TARGET DESTROYED***') == 5
    assert 'BOOM !!!  YOU HAVE JUST BEEN DESTROYED ' in output
    assert output.count('\x07') == 60
    assert output.count('TRY AGAIN.....') == 2
    console.sendcontrol('c')
    console.expect_exact(ready)
    enter(console, 'NEW PRTBEL')
    console.expect_exact(ready)
    probe = ['10 PRINT -46500;-43000;-32769;-32768',
             '20 PRINT 32767;32768;42999;43000;46500',
             '30 PRINT "A";CHR$(7);TAB(3);"B"', '40 END']
    for line in probe:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'RUN')
    console.expect(r'PRTBEL +[^\r\n]*\r\n')
    console.expect_exact(ready)
    observed = console.before.replace('\r\n', '\n')
    assert observed.endswith('\n\n')
    return {'answers': selected, 'output': output, 'printProbeOutput': observed[:-1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ('simulator', 'v4a-disk', 'v4b-disk', 'output'):
        parser.add_argument('--' + argument, type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    v4b = runpy.run_path(str(directory / 'capture-nicoma-rsts.py'))
    shared = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    digest = v4a['digest']
    assert digest(args.v4b_disk.read_bytes()) == V4B_DISK_SHA256
    raw = (FIXTURES / 'gunner.bas').read_bytes()
    reviewed = (FIXTURES / 'gunner-mar75-text.bas').read_bytes()
    portable = (FIXTURES / 'gunner-ma2.bas').read_bytes()

    def replay(disk, boot, source, answers=None):
        lines = [line for line in source.decode('ascii').splitlines() if line != '90 RANDOMIZE']
        with tempfile.TemporaryDirectory(prefix='gunner-rsts-') as temporary:
            path = Path(temporary)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(shared['BOOT'], encoding='ascii')
            console = pexpect.spawn(str(args.simulator.resolve()), ['boot.ini'], cwd=path,
                                    encoding='ascii', timeout=25)
            try:
                return capture(console, boot, shared, lines, answers)
            finally:
                console.close(force=True)

    captured = replay(args.v4a_disk, v4a['boot'], reviewed)
    for disk, boot, source in ((args.v4a_disk, v4a['boot'], portable),
                              (args.v4b_disk, v4b['boot'], reviewed),
                              (args.v4b_disk, v4b['boot'], portable)):
        assert replay(disk, boot, source, captured['answers']) == captured
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'],
        'systems': [v4a['BUILD'], v4b['BUILD']],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()),
        'v4bDiskSha256': V4B_DISK_SHA256,
        'pinnedFixtureSha256': digest(raw),
        'reviewedFixtureSha256': digest(reviewed),
        'portableFixtureSha256': digest(portable),
        **captured,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
