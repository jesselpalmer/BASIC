"""Replay complete reviewed/adapted SYNONM games on V4A-12 MA2 and V04B-17."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
PINNED_SHA256 = '81e0671eda626980ff0e80f59cb81d82426c46ffac1bbcd60e7cce6a6da1747e'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'


def capture(console, boot, shared, source):
    boot(console)
    enter, ready = shared['enter'], shared['READY']
    enter(console, 'NEW SYNONM')
    console.expect_exact(ready)
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'SYNONM +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join('\r\n'.join(line[i:i+72] for i in range(0, len(line), 72)) + '\r\n' for line in source)
    assert console.before[title.end():] == expected + '\r\n', repr(console.before[title.end():])
    enter(console, 'RUN')
    console.expect(r'SYNONM +[^\r\n]*\r\n')
    console.expect_exact('? ')
    chunks = [console.before + console.after]
    turns = []
    groups = {}
    for line in source:
        if re.match(r'5[1-9]0 DATA|600 DATA', line):
            words = re.findall(r'"([^"]*)"', line)
            groups[words[0]] = words[1]
    while True:
        output = ''.join(chunks)
        word = re.findall(r'WHAT IS A SYNONYM OF ([A-Z]+)', output)[-1]
        answer = 'NOTAWORD' if len(turns) == 0 else 'HELP' if len(turns) in (1, 2) else groups[word]
        turns.append({'prompt': '', 'answer': answer})
        enter(console, answer)
        match = console.expect([re.compile(re.escape('? ')), re.compile(re.escape(ready))])
        chunks.append(console.before + (console.after if match == 0 else ''))
        if match == 1:
            break
        assert len(turns) < 30
    output = ''.join(chunks).replace('\r\n', '\n')
    assert 'TRY AGAIN.' in output and output.count('**** A SYNONYM') == 2
    assert 'SYNONYM DRILL COMPLETED.' in output
    # Stock STOP diagnostic is a monitor outcome, outside host program text.
    output = re.sub(r'STOP at line 420 *\n', '', output)
    return {'turns': turns, 'output': output[:-1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--v4a-disk', type=Path, required=True)
    parser.add_argument('--v4b-disk', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    v4b = runpy.run_path(str(directory / 'capture-nicoma-rsts.py'))
    shared = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    digest = v4a['digest']
    assert digest(args.v4b_disk.read_bytes()) == V4B_DISK_SHA256
    raw = (FIXTURES / 'synonm.bas').read_bytes()
    reviewed = (FIXTURES / 'synonm-mar75-text.bas').read_bytes()
    portable = (FIXTURES / 'synonm-ma2.bas').read_bytes()
    assert digest(raw) == PINNED_SHA256

    def replay(disk, boot, source):
        # RANDOMIZE omitted only for a reproducible archive default stream.
        lines = source.decode('ascii').replace('RANDOMIZE:', '').splitlines()
        with tempfile.TemporaryDirectory(prefix='synonm-rsts-') as temporary:
            path = Path(temporary)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(shared['BOOT'], encoding='ascii')
            console = pexpect.spawn(str(args.simulator.resolve()), ['boot.ini'], cwd=path, encoding='ascii', timeout=25)
            try:
                return capture(console, boot, shared, lines)
            finally:
                console.close(force=True)

    captured = replay(args.v4a_disk, v4a['boot'], reviewed)
    for disk, boot, source in ((args.v4a_disk, v4a['boot'], portable),
                               (args.v4b_disk, v4b['boot'], reviewed),
                               (args.v4b_disk, v4b['boot'], portable)):
        assert replay(disk, boot, source) == captured
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'], 'systems': [v4a['BUILD'], v4b['BUILD']],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()), 'v4bDiskSha256': V4B_DISK_SHA256,
        'pinnedFixtureSha256': PINNED_SHA256, 'reviewedFixtureSha256': digest(reviewed),
        'portableFixtureSha256': digest(portable), **captured,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
