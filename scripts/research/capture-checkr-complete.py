"""Capture a complete CHECKR game with captures, kinging and a human win."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect

TURNS = [
    {'computer': [2, 6, 1, 5], 'human': [3, 3, 2, 4]},
    {'computer': [1, 7, 2, 6], 'human': [7, 3, 8, 4]},
    {'computer': [2, 8, 1, 7], 'human': [2, 2, 3, 3]},
    {'computer': [4, 6, 5, 5], 'human': [5, 3, 6, 4]},
    {'computer': [3, 7, 4, 6], 'human': [3, 3, 4, 4]},
    {'computer': [4, 8, 3, 7], 'human': [2, 4, 3, 5]},
    {'computer': [1, 5, 2, 4], 'human': [6, 2, 5, 3]},
    {'computer': [2, 6, 1, 5], 'human': [7, 1, 6, 2]},
    {'computer': [1, 7, 2, 6], 'human': [3, 5, 1, 7]},
    {'computer': [3, 7, 2, 6], 'human': [1, 3, 3, 5]},
    {'computer': [1, 5, 2, 4], 'human': [8, 4, 7, 5]},
    {'computer': [2, 4, 1, 3], 'human': [6, 2, 7, 3]},
    {'computer': [2, 6, 1, 5], 'human': [1, 7, 2, 8]},
    {'computer': [1, 5, 2, 4], 'human': [2, 8, 3, 7]},
    {'computer': [2, 4, 3, 3], 'human': [3, 5, 2, 6]},
    {'computer': [4, 6, 3, 5], 'human': [6, 4, 4, 6]},
    {'computer': [3, 5, 2, 4], 'human': [2, 6, 1, 7]},
    {'computer': [6, 6, 5, 5], 'human': [4, 4, 6, 6]},
    {'computer': [5, 7, 3, 5], 'human': [7, 3, 6, 4]},
    {'computer': [3, 5, 4, 4], 'human': [5, 3, 3, 5]},
    {'computer': [1, 3, 2, 2], 'human': [3, 1, 1, 3]},
    {'computer': [3, 3, 2, 2], 'human': [1, 1, 3, 3]},
    {'computer': [6, 8, 5, 7], 'human': [3, 3, 1, 5]},
    {'computer': [5, 7, 4, 6], 'human': [3, 7, 5, 5]},
]

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
    answers = []
    turns = TURNS
    for index, turn in enumerate(turns):
        move = re.findall(r'I MOVE FROM \( ([^)]*)\) TO \( ([^)]*)\)', chunks[-1])
        assert move, (index, chunks[-1])
        if move:
            observed = [int(x) for pair in move[-1] for x in pair.split()]
            assert observed == turn['computer'], (index, observed, turn['computer'])
        replies = [('YES', 'FROM? ')]
        if index == 0:
            replies.append(('0,0', 'FROM? '))
        replies.append((','.join(map(str, turn['human'][:2])), 'TO? '))
        if index == 0:
            replies.append(('1,1', 'TO? '))
        for answer, prompt in replies:
            enter(console, answer)
            console.expect_exact(prompt)
            chunks.append(console.before + console.after)
            answers.append(answer)
        answer = ','.join(map(str, turn['human'][2:]))
        enter(console, answer)
        answers.append(answer)
        event = console.expect_exact(['BOARD? ', ready])
        chunks.append(console.before + (console.after if event == 0 else ''))
        if event == 1:
            assert index == len(turns) - 1, (index, chunks[-1])
            break
    output = ''.join(chunks).replace('\r\n', '\n')
    assert 'VERY GOOD, YOU WIN!' in output, repr(output[-500:])
    assert output.count('I MOVE FROM') == len(turns)
    assert 'O*' in output
    assert 'THERE IS NO ONE OCCUPING THAT SPACE' in output
    assert 'THAT SPACE IS ALREADY OCCUPIED' in output
    # Ready contributes one final monitor newline after the program's last PRINT.
    assert output.endswith('-CHUCK OUT\n\n'), repr(output[-100:])
    return {'inputs': answers, 'turns': turns, 'output': output[:-1], 'monitorSuffix': '\n'}


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
        'completeGame': captured,
        'edu30Boundary': {'tapeSha256': edu['TAPE_SHA256'], 'source': PROBE, 'output': diagnostic},
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
