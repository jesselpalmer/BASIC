"""Replay complete reviewed/adapted BULEYE games on V4A-12 MA2 and V04B-17."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
PINNED_SHA256 = '0524ba20134afa28d0198f240acee89dc3868e87c0034fafe2565ca1ffe496ba'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'


def capture(console, boot, shared, source):
    boot(console)
    enter, ready = shared['enter'], shared['READY']
    enter(console, 'NEW BULEYE')
    console.expect_exact(ready)
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'BULEYE +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join('\r\n'.join(line[i:i+72] for i in range(0, len(line), 72)) + '\r\n' for line in source)
    assert console.before[title.end():] == expected + '\r\n', repr(console.before[title.end():])
    enter(console, 'RUN')
    console.expect(r'BULEYE +[^\r\n]*\r\n')
    console.expect_exact('HOW MANY PLAYERS? ')
    chunks = [console.before + console.after]
    turns = []
    answer, prompt = '2', 'HOW MANY PLAYERS'
    throws = 0
    while True:
        turns.append({'prompt': prompt, 'answer': answer})
        enter(console, answer)
        match = console.expect([re.compile(re.escape('? ')), re.compile(re.escape(ready))])
        chunks.append(console.before + (console.after if match == 0 else ''))
        if match == 1:
            break
        if len(turns) == 1:
            answer = 'ADA'
        elif len(turns) == 2:
            answer = 'BEN'
        elif len(turns) == 3:
            answer = '-1'
        elif len(turns) == 4:
            answer = '4'
        else:
            answer = str(throws % 3 + 1)
            throws += 1
        prompt = ''
        assert len(turns) < 100
    output = ''.join(chunks).replace('\r\n', '\n')
    assert output.count('INPUT 1, 2, OR 3') == 2
    assert 'WE HAVE A WINNER!!' in output
    assert output.endswith('THANKS FOR THE GAME!\n\n')
    assert 'ADA\'S THROW' in output and 'BEN\'S THROW' in output
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
    raw = (FIXTURES / 'buleye.bas').read_bytes()
    reviewed = (FIXTURES / 'buleye-mar75-text.bas').read_bytes()
    portable = (FIXTURES / 'buleye-ma2.bas').read_bytes()
    assert digest(raw) == PINNED_SHA256

    def replay(disk, boot, source):
        # RANDOMIZE omitted only for a reproducible archive default stream.
        lines = source.decode('ascii').replace('\\RANDOMIZE', '').replace(':RANDOMIZE', '').splitlines()
        with tempfile.TemporaryDirectory(prefix='buleye-rsts-') as temporary:
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
