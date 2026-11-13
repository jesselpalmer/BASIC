"""Replay BAGLES on the rebuilt V4A-12 MA2 and archived V04B-17 systems."""
import argparse
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
PINNED_SHA256 = '032c831d2d037bcad31a0621bcc5b766119957c58d2e617fa88c4e3d5319cf53'
V4B_DISK_SHA256 = '653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f'
RULES = 'GAME OF BAGLES.  WOULD YOU LIKE THE RULES (YES OR NO)'
REPLAY = 'PLAY AGAIN (YES OR NO)'
GUESS = re.compile(r'GUESS # *([1-9][0-9]*) \? ')
ANSWERS = ['NO', '12', 'ABC', '112', '012', '134', '350', '460', '740', 'YES'] + ['012'] * 20 + ['NO']


def capture(console, boot, shared, source):
    boot(console)
    enter, ready = shared['enter'], shared['READY']
    enter(console, 'NEW BAGLES')
    console.expect_exact(ready)
    for line in source:
        enter(console, line)
        assert not console.before.strip(), repr(console.before)
    enter(console, 'LIST')
    console.expect_exact(ready)
    title = re.search(r'BAGLES +[^\r\n]*\r\n', console.before)
    assert title
    expected = ''.join(
        '\r\n'.join(line[i:i+72] for i in range(0, len(line), 72)) + '\r\n'
        for line in source
    )
    assert console.before[title.end():] == expected + '\r\n', repr(console.before[title.end():])
    enter(console, 'RUN')
    console.expect(r'BAGLES +[^\r\n]*\r\n')
    console.expect_exact(RULES + '? ')
    chunks = [console.before + console.after]
    turns = []
    prompt = RULES
    for index, answer in enumerate(ANSWERS):
        turns.append({'prompt': prompt, 'answer': answer})
        enter(console, answer)
        match = console.expect([GUESS, re.compile(re.escape(REPLAY + '? ')), ready])
        chunks.append(console.before + (console.after if match < 2 else ''))
        if match == 0:
            prompt = ''
            guess_number = int(console.match.group(1))
            expected_guess = 1 if index <= 3 or index == 9 else index - (2 if index <= 7 else 8)
            assert guess_number == expected_guess, (index, answer, guess_number, expected_guess)
        elif match == 1:
            assert index in (8, 29), index
            prompt = REPLAY
        else:
            assert index == len(ANSWERS) - 1, index
    output = ''.join(chunks).replace('\r\n', '\n')
    assert 'TRY GUESSING A THREE-DIGIT NUMBER.' in output
    assert 'WHAT?' in output
    assert 'MIND HAS NO TWO DIGITS THE SAME.' in output
    assert 'PICO FERMI ' in output
    assert output.count('YOU GOT IT!!!') == 1
    assert "THAT'S 20 GUESSES.  MY NUMBER WAS  259 " in output
    assert output.endswith('HOPE YOU HAD FUN.  BYE.\n\n')
    # The RSTS monitor appends a newline after the program's final PRINT.
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
    raw = (FIXTURES / 'bagels.bas').read_bytes()
    reviewed = (FIXTURES / 'bagles-mar75-text.bas').read_bytes()
    portable = (FIXTURES / 'bagles-ma2.bas').read_bytes()
    assert digest(raw) == PINNED_SHA256

    def replay(disk, boot, source):
        # Removing RANDOMIZE gives the stock initial stream. The public
        # acceptance uses the shipped source with a zero entropy word.
        lines = source.decode('ascii').replace('40 RANDOMIZE:Y=0:T=255', '40 Y=0:T=255').splitlines()
        with tempfile.TemporaryDirectory(prefix='bagles-rsts-') as temporary:
            path = Path(temporary)
            shutil.copyfile(disk, path / 'working.dsk')
            (path / 'boot.ini').write_text(shared['BOOT'], encoding='ascii')
            console = pexpect.spawn(str(args.simulator.resolve()), ['boot.ini'], cwd=path,
                                    encoding='ascii', timeout=25)
            try:
                return capture(console, boot, shared, lines)
            finally:
                console.close(force=True)

    captured = replay(args.v4a_disk, v4a['boot'], reviewed)
    for disk, boot, source in (
        (args.v4a_disk, v4a['boot'], portable),
        (args.v4b_disk, v4b['boot'], reviewed),
        (args.v4b_disk, v4b['boot'], portable),
    ):
        assert replay(disk, boot, source) == captured
    args.output.write_text(json.dumps({
        'simulatorCommit': v4a['SIMH_COMMIT'],
        'systems': [v4a['BUILD'], v4b['BUILD']],
        'v4aDiskSha256': digest(args.v4a_disk.read_bytes()),
        'v4bDiskSha256': V4B_DISK_SHA256,
        'pinnedFixtureSha256': PINNED_SHA256,
        'reviewedFixtureSha256': digest(reviewed),
        'portableFixtureSha256': digest(portable),
        **captured,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
