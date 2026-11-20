"""Replay reviewed WAR as a candidate on V4A-12 MA2 and V04B-17."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
PINNED_SHA256 = '2b691983456b0ce787c5d6175e58f2a5096d10031bed71ac87dd704d4df2d401'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'


def capture(console, boot, shared, source):
    boot(console)
    ready = shared['READY']
    wrapped = runpy.run_path(str(Path(__file__).with_name('capture-gunner-rsts.py')))['wrapped']
    def enter(console, line):
        console.send(line + '\r')
        console.expect_exact(wrapped(line) + '\r\n')
    enter(console, 'NEW WAR')
    console.expect_exact(ready)
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'WAR +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join(wrapped(line) + '\r\n' for line in source)
    assert console.before[title.end():] == expected + '\r\n', repr(console.before[title.end():])
    enter(console, 'RUN')
    console.expect(r'WAR +[^\r\n]*\r\n')
    console.expect_exact('? ')
    chunks = [console.before + console.after]
    turns = []
    while True:
        answer = 'MAYBE' if len(turns) in (0, 2) else 'YES'
        turns.append({'prompt': '', 'answer': answer})
        enter(console, answer)
        match = console.expect([re.compile(re.escape('? ')), re.compile(re.escape(ready))])
        chunks.append(console.before + (console.after if match == 0 else ''))
        if match == 1:
            break
        assert len(turns) < 40
    output = ''.join(chunks).replace('\r\n', '\n')
    assert output.count('YOU: ') == 26
    assert output.count('YES OR NO, PLEASE.') == 2
    assert 'YOU HAVE RUN OUT OF CARDS.' in output
    assert 'TIE.  NO SCORE CHANGE.' in output
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
    raw = (FIXTURES / 'war.bas').read_bytes()
    reviewed = (FIXTURES / 'war-mar75-text.bas').read_bytes()
    assert digest(raw) == PINNED_SHA256

    def replay(disk, boot, source):
        # RANDOMIZE omitted only for a reproducible archive default stream.
        lines = [line for line in source.decode('ascii').splitlines() if line != '270 RANDOM']
        with tempfile.TemporaryDirectory(prefix='war-rsts-') as temporary:
            path = Path(temporary)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(shared['BOOT'], encoding='ascii')
            console = pexpect.spawn(str(args.simulator.resolve()), ['boot.ini'], cwd=path, encoding='ascii', timeout=25)
            try:
                return capture(console, boot, shared, lines)
            finally:
                console.close(force=True)

    captured = replay(args.v4a_disk, v4a['boot'], reviewed)
    assert replay(args.v4b_disk, v4b['boot'], reviewed) == captured
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'], 'systems': [v4a['BUILD'], v4b['BUILD']],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()), 'v4bDiskSha256': V4B_DISK_SHA256,
        'pinnedFixtureSha256': PINNED_SHA256, 'reviewedFixtureSha256': digest(reviewed),
        **captured,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
