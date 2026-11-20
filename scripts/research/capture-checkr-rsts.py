"""Capture bounded CHECKR opening moves and the EDU30 string-comparison boundary."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
PINNED_SHA256 = 'cbb1a2b6f8bc971fef162e8de67ba67af25a6c61a55cbc38559928afb93c26b4'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
PROBE = ['10 INPUT D$', '20 IF D$<>"YES" THEN 40', '30 PRINT "BOARD"', '40 END']


def capture(console, boot, shared, lines):
    boot(console)
    enter, ready = shared['enter'], shared['READY']
    enter(console, 'NEW CHECKR')
    console.expect_exact(ready)
    for line in lines:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'CHECKR +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join('\r\n'.join(line[i:i+72] for i in range(0, len(line), 72)) + '\r\n' for line in lines)
    assert console.before[title.end():] == expected + '\r\n'
    enter(console, 'RUN')
    console.expect(r'CHECKR +[^\r\n]*\r\n')
    console.expect_exact('BOARD? ')
    chunks = [console.before + console.after]
    for answer, prompt in [('YES', 'FROM? '), ('0,0', 'FROM? '), ('1,3', 'TO? '), ('2,4', 'BOARD? '), ('YES', 'FROM? ')]:
        enter(console, answer)
        console.expect_exact(prompt)
        chunks.append(console.before + console.after)
    output = ''.join(chunks).replace('\r\n', '\n')
    assert 'THERE IS NO ONE OCCUPING THAT SPACE' in output
    assert output.count('I MOVE FROM') == 2
    console.sendcontrol('c')
    console.expect_exact(ready)
    return {'inputs': ['YES', '0,0', '1,3', '2,4', 'YES'], 'output': output,
            'stoppedAt': 'third human FROM prompt; complete game unverified'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--v4a-disk', type=Path, required=True)
    parser.add_argument('--v4b-disk', type=Path, required=True)
    parser.add_argument('--pdp8', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    v4a = runpy.run_path(str(directory / 'capture-life2-rsts.py'))
    v4b = runpy.run_path(str(directory / 'capture-nicoma-rsts.py'))
    shared = runpy.run_path(str(directory / 'capture-fipfop-rsts.py'))
    edu = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    digest = v4a['digest']
    raw = (FIXTURES / 'checkr.bas').read_bytes()
    reviewed = (FIXTURES / 'checkr-mar75-text.bas').read_bytes()
    assert digest(raw) == PINNED_SHA256
    assert digest(args.v4b_disk.read_bytes()) == V4B_DISK_SHA256
    assert digest(args.tape.read_bytes()) == edu['TAPE_SHA256']

    def replay(disk, boot):
        with tempfile.TemporaryDirectory(prefix='checkr-rsts-') as temporary:
            path = Path(temporary)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(shared['BOOT'], encoding='ascii')
            console = pexpect.spawn(str(args.simulator.resolve()), ['boot.ini'], cwd=path, encoding='ascii', timeout=25)
            try:
                return capture(console, boot, shared, reviewed.decode('ascii').splitlines())
            finally:
                console.close(force=True)

    captured = replay(args.v4a_disk, v4a['boot'])
    assert replay(args.v4b_disk, v4b['boot']) == captured
    with edu['edu30'](args.pdp8.resolve(), args.tape.resolve()) as console:
        for line in PROBE:
            edu['send_line'](console, line)
        edu['send_line'](console, 'RUN')
        console.expect_exact('READY')
        diagnostic = edu['normalize'](console.before)
        assert diagnostic == '\x0c\n\n*NONE*  EDUSYSTEM-30\n\nS1 20\n\n', repr(diagnostic)
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'], 'systems': [v4a['BUILD'], v4b['BUILD']],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()), 'v4bDiskSha256': V4B_DISK_SHA256,
        'pinnedFixtureSha256': PINNED_SHA256, 'reviewedFixtureSha256': digest(reviewed),
        'boundedOpening': captured,
        'edu30Boundary': {'tapeSha256': edu['TAPE_SHA256'], 'source': PROBE, 'output': diagnostic},
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
