"""Run the reviewed LIFE2 listing on archived Altair 8K BASIC 4.0.

The editor consumes @ as line erase. This probe restores the four literal bytes
in the stored line, verifies the full LIST and leaves the interpreter untouched.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
from struct import unpack_from
import tempfile

import pexpect

from life2_altair_rules import capture_coordinate_retries, capture_dialogue, capture_rules
from life2_reference import DRAW_ANSWERS, annotated_sample, boards, verify_annotated_sample

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
SIMH_COMMIT = '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6'
IMAGE_HASH = '588e1f69dd30f595a3032d39fbebd452d5506d0d01aebc59b664abd7d2703d5f'
TITLE = '          U.B LIFE GAME\n'
MASK = 'XXXX\r@@@@\r\n? '
PLACEHOLDER = '"ZWQZ"'
LITERAL = '"@@@@"'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def enter(console, line):
    console.send(line + '\r')
    console.expect_exact(line)
    console.expect_exact('\r\n')


def boot(console):
    console.expect_exact(f'simh git commit id: {SIMH_COMMIT[:8]}')
    console.expect_exact('MEMORY SIZE?')
    console.send('\r')
    console.expect_exact('TERMINAL WIDTH?')
    console.send('80\r')
    console.expect_exact('WANT SIN-COS-TAN-ATN?')
    console.send('Y\r')
    console.expect_exact('ALTAIR BASIC REV. 4.0')
    console.expect_exact('[EIGHT-K VERSION]')
    console.expect_exact('COPYRIGHT 1976 BY MITS INC.')
    console.expect_exact('OK')


def monitor(console, command):
    console.send(command + '\r')
    console.expect_exact('sim> ')
    return console.before


def line_ranges(memory, labels):
    """Locate the one chain of linked BASIC lines with the reviewed labels."""
    chains = []
    for match in re.finditer(b'\x01\x00', memory):
        start = match.start() - 2
        chain = {}
        for expected in labels:
            if not 0 <= start <= len(memory) - 4:
                break
            end, label = unpack_from('<HH', memory, start)
            if label != expected or not start + 4 < end < len(memory) or memory[end - 1] != 0:
                break
            chain[label] = (start + 4, end - 1)
            start = end
        if len(chain) == len(labels):
            chains.append(chain)
    assert len(chains) == 1, len(chains)
    return chains[0]


def normalized_line(line):
    return '"'.join(part if index % 2 else part.replace(' ', '')
                    for index, part in enumerate(line.split('"')))


def load_reviewed(console, root, source):
    line_700 = next(line for line in source if line.startswith('700 '))
    console.send(line_700 + '\r')
    console.expect_exact('?SN ERROR')
    # Each typed @ erases the current entry and starts a new terminal line.
    assert console.before.count('@\r\n') == 4, console.before
    console.expect_exact('OK')
    enter(console, 'NEW')
    console.expect_exact('OK')
    for line in source:
        enter(console, line.replace(LITERAL, PLACEHOLDER))

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    dump_before = monitor(console, 'dump before.bin 0-ffff')
    assert '65536 bytes dumped' in dump_before, dump_before
    before = (root / 'before.bin').read_bytes()
    labels = [int(line.split()[0]) for line in source]
    low, high = line_ranges(before, labels)[700]
    literal_bytes = PLACEHOLDER.encode('ascii')
    assert before.count(literal_bytes) == 1
    offset = before.index(literal_bytes) + 1
    assert low <= offset - 1 and offset + 5 <= high
    for address in range(offset, offset + 4):
        monitor(console, f'd {address:x} 40')
    dump_after = monitor(console, 'dump after.bin 0-ffff')
    assert '65536 bytes dumped' in dump_after, dump_after
    after = (root / 'after.bin').read_bytes()
    assert after == before[:offset] + b'@@@@' + before[offset + 4:]

    console.send('cont\r')
    enter(console, 'LIST')
    console.expect_exact('OK')
    listed = re.findall(r'^ *(\d+ .*)\r$', console.before, re.M)
    assert [normalized_line(line) for line in listed] == [
        normalized_line(line) for line in source
    ], listed
    return offset


def play(console, sample):
    win_answers = [answer for pair in sample['opening'] + sample['turns'] for answer in pair]
    answers = win_answers + DRAW_ANSWERS
    event, chunks = capture_dialogue(console, enter, answers)
    assert event == 1 and all(chunk.endswith(MASK) for chunk in chunks), chunks
    transcript = ''.join(chunk + answer + '\n' for chunk, answer in zip(chunks, answers)) + chunks[-1]
    assert transcript.count(MASK) == len(answers) + 1
    prefix, win, draw, opening = transcript.split(TITLE)
    assert not prefix.strip()
    assert boards(win) == sample['boards']
    assert 'SAME COORD. SET TO 0' in win
    assert win.endswith(f"PLAYER {sample['winner']} IS THE WINNER\n")
    assert boards(draw) == [['*.*.*', '.....', '.....', '.....', '#.#.#'], ['.....'] * 5]
    assert draw.endswith('A DRAW\n')
    assert opening == 'PLAYER 1 3 LIVE PIECES\nX,Y\n' + MASK
    console.sendcontrol('c')
    console.expect_exact('BREAK IN 700')
    console.expect_exact('OK')
    return {
        'winBoards': len(boards(win)),
        'drawBoards': len(boards(draw)),
        'resultLines': ['PLAYER 1 IS THE WINNER', 'A DRAW'],
        'restartPrompts': 2,
        'coordinateMask': MASK,
        'interrupt': 'BREAK IN 700',
        'transcriptSha256': digest(transcript.encode('ascii')),
        'outputAndPromptsSha256': digest(''.join(chunks).encode('ascii')),
    }


def capture_annotated(console, sample):
    answers = sample['answers'].copy()
    edit_index = sample['rubout']['answerIndex']
    edit = sample['rubout']['keystrokes'].replace('\x7f', '_')
    answers[edit_index] = edit
    event, chunks = capture_dialogue(console, enter, answers)
    assert event == 1 and all(chunk.endswith(MASK) for chunk in chunks), chunks
    transcript = ''.join(chunks)
    verify_annotated_sample(transcript, sample)
    winner = f"PLAYER {sample['winner']} IS THE WINNER"
    assert chunks[-1].endswith(winner + '\n' + TITLE + 'PLAYER 1 3 LIVE PIECES\nX,Y\n' + MASK)
    console.sendcontrol('c')
    console.expect_exact('BREAK IN 700')
    console.expect_exact('OK')
    return {
        'printedPage': sample['printedPage'],
        'editEcho': edit,
        'boards': len(sample['boards']),
        'coordinateRetries': sample['coordinateRetries'],
        'sameCoordinateMoves': sample['sameCoordinateMoves'],
        'winner': winner,
        'outputAndPromptsSha256': digest(transcript.encode('ascii')),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--annotated', action='store_true', help='Replay the page 149 sample')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = (FIXTURES / 'life2-mar75-reviewed.bas').read_bytes()
    sample = annotated_sample() if args.annotated else json.loads(
        (FIXTURES / 'life2-sample.json').read_text(encoding='ascii')
    )
    assert digest(source) == sample['sourceSha256']
    assert digest(args.image.read_bytes()) == IMAGE_HASH
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copyfile(args.image, root / 'basic.bin')
        (root / 'boot.ini').write_text(
            'set cpu 8080\nset sio upper\nset sio ansi\nd sr 8\nload basic.bin 0\ngo 0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(args.simulator.resolve()), ['boot.ini'], cwd=directory, encoding='ascii', timeout=20,
        ) as console:
            console.delaybeforesend = 0.08
            boot(console)
            offset = load_reviewed(console, root, source.decode('ascii').splitlines())
            if args.annotated:
                replay = capture_annotated(console, sample)
            else:
                replay = {
                    'drawAnswers': DRAW_ANSWERS,
                    **play(console, sample),
                    'coordinateRetries': capture_coordinate_retries(console, enter, MASK),
                    'rules': capture_rules(console, enter),
                }
    result = {
        'schemaVersion': 2,
        'simulatorCommit': SIMH_COMMIT,
        'build': 'Altair BASIC 4.0 [Eight-K Version], 1976',
        'imageSha256': IMAGE_HASH,
        'sourceSha256': digest(source),
        'editorError': '?SN ERROR',
        'maskAddressHex': f'{offset:04x}',
        **replay,
    }
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')
    print(f'Captured LIFE2 observations in {args.output}')


if __name__ == '__main__':
    main()
