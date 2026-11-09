"""Capture LIFE2 in the selected RSTS V4A-12 MA2 build.

Build the scratch RK05 disk in docs/rsts-v4a-build.md and provide its raw copy
before REFRESH. The capture requires pexpect and never writes to the input disk.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

import pexpect

from life2_reference import DRAW_ANSWERS, boards

FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
SIMH_COMMIT = '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6'
BUILD = 'RSTS V4A-12 V4A12MA2'
MASK = 'XXXX\r@@@@\r\n? '
DECUS_SOURCE_URL = 'https://pdp-11.trailing-edge.com/rsts11/rsts-11-014/LIFE2.BAS'
DECUS_SOURCE_SHA256 = '93513ed242e08f9d9e77a3e4f599157c2f7cc55e0fe014d2998fed9b560c2941'
DECUS_MASK = 'XXXXX\r@@@@@\r? '
DRAW_BOARDS = [['*.*.*', '.....', '.....', '.....', '#.#.#'], ['.....'] * 5]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def reply(console, prompt, answer):
    console.expect_exact(prompt)
    console.send(answer + '\r')


def enter(console, line):
    console.send(line + '\r')
    console.expect_exact(line)
    before = console.before
    console.expect_exact('\r\n')
    return before


def boot(console):
    console.expect_exact(f'simh git commit id: {SIMH_COMMIT[:8]}')
    console.expect_exact(BUILD)
    for prompt, answer in [
        ('OPTION? ', 'REFRESH'),
        ('SURE? ', 'YES'),
        ('DD-MON-YY? ', '12-DEC-72'),
        ('HH:MM? ', '12:34'),
        ('CRASH.SYS(Y OR N), OVER.SYS(O), ERRM.SYS(E) FILES WANTED? ', 'Y'),
        ('PACK SERIAL ID, CLUSTER SIZE? ', 'V4AMA2,1'),
        ('MANAGER PASSWORD, MFD CLUSTER? ', 'MNGR,1'),
        ('LIBRARY PASSWORD, UFD CLUSTER? ', 'LIBR,4'),
        ('BAD BLOCK FILE? ', 'IGNORE'),
    ]:
        reply(console, prompt, answer)
    console.expect_exact('IGNORE\r\n')
    # REFRESH reaches the documented clock wait before accepting another command.
    console.expect(pexpect.TIMEOUT, timeout=0.5)
    console.sendcontrol('e')
    reply(console, 'sim> ', 'DEPOSIT CLK CSR 100')
    reply(console, 'sim> ', 'CONTINUE')
    console.expect_exact(BUILD)
    for prompt, answer in [
        ('OPTION? ', 'START'),
        ('DD-MON-YY? ', '12-DEC-72'),
        ('HH:MM? ', '12:34'),
        ('ENABLE CRASH DUMP? ', 'N'),
    ]:
        reply(console, prompt, answer)
    console.expect_exact("CAN'T FIND FILE OR ACCOUNT")
    console.expect_exact('Ready')


def enter_program(console, name, source):
    enter(console, f'NEW {name}')
    console.expect_exact('Ready')
    entry_output = ''.join(enter(console, line) for line in source)
    entry_output += enter(console, 'LIST')
    console.expect_exact('Ready')
    listed = re.findall(r'^([?]?\d+ .*)\r$', console.before, re.M)
    assert [line.removeprefix('?') for line in listed] == source, listed
    flagged = [int(line[1:].split()[0]) for line in listed if line.startswith('?')]
    errors = [int(label) for label in re.findall(r'ILLEGAL VERB at line (\d+)', entry_output)]
    assert flagged == errors, (flagged, errors)
    return flagged


def play(console, answers, mask=MASK):
    enter(console, 'RUN')
    chunks = []
    for answer in answers:
        event = console.expect_exact(['? ', 'Ready'])
        assert event == 0, console.before
        chunks.append(console.before + console.after)
        enter(console, answer)
        chunks.append(answer + '\r\n')
    console.expect_exact('Ready')
    chunks.append(console.before)
    text = ''.join(chunks).replace('\r\n', '\n')
    text = re.sub(r'^LIFE2 +[^\n]*\n', '', text, count=1)
    assert text.count(mask) == len(answers), repr(text)
    return text


def observation(transcript, ending):
    assert transcript.rstrip().endswith(ending), repr(transcript[-200:])
    return {
        'boards': len(boards(transcript)),
        'ending': ending,
        'transcriptSha256': digest(transcript.encode('ascii')),
    }


def capture(console, source, sample):
    errors = enter_program(console, 'LIFE2', source)
    assert errors == [574, 575], errors
    answers = [answer for pair in sample['opening'] + sample['turns'] for answer in pair]
    exact_win = play(console, answers)
    exact_draw = play(console, DRAW_ANSWERS)
    assert boards(exact_win) == sample['boards']
    assert 'SAME COORD. SET TO 0' in exact_win
    assert boards(exact_draw) == DRAW_BOARDS

    end_probe = [
        line.removesuffix(':RUN') + ':END' if line.startswith(('574 ', '575 ')) else line
        for line in source
    ]
    probe_errors = enter_program(console, 'LIFE2', end_probe)
    assert probe_errors == [], probe_errors
    probe_win = play(console, answers)
    probe_draw = play(console, DRAW_ANSWERS)
    assert boards(probe_win) == boards(exact_win)
    assert boards(probe_draw) == boards(exact_draw)

    branch = next(line for line in source if line.startswith('741 '))
    offset_errors = enter_program(console, 'OFFSET', [
        '10 DIMN1(6,6),X(2),Y(2)',
        '20 LETB=2:LETX(2)=2:LETY(2)=2:LETN1(3,3)=100:LETN1(1,1)=1000',
        '30 PRINT"BEFORE";N1(3,3);N1(1,1)',
        '40 GOSUB741',
        '50 PRINT"AFTER";N1(3,3);N1(1,1);B',
        '60 END',
        branch,
    ])
    assert offset_errors == [], offset_errors
    enter(console, 'RUN')
    console.expect_exact('Ready')
    offset = re.findall(r'^(?:BEFORE|AFTER) [^\r\n]+', console.before, re.M)
    assert offset == ['BEFORE 100  1000 ', 'AFTER 0  1000  99 '], offset

    return {
        'entryIllegalVerbLabels': errors,
        'coordinatePrompt': MASK,
        'drawAnswers': DRAW_ANSWERS,
        'exactWin': observation(exact_win, 'ILLEGAL STATEMENT at line 575'),
        'exactDraw': observation(exact_draw, 'ILLEGAL STATEMENT at line 574'),
        'endProbeWin': observation(probe_win, 'PLAYER 1 IS THE WINNER'),
        'endProbeDraw': observation(probe_draw, 'A DRAW'),
        'occupiedOffsetProbe': offset,
    }


def capture_decus(console, source, sample):
    enter(console, 'NEW LIFE2')
    console.expect_exact('Ready')
    entry_output = []
    for index, line in enumerate(source):
        # RSTS uses LF for a continuation and CR to end a numbered line.
        continued = index + 1 < len(source) and source[index + 1].startswith('\t')
        console.send(line + ('\n' if continued else '\r'))
        console.expect_exact(line.expandtabs(8))
        entry_output.append(console.before)
        console.expect_exact('\n' if continued else '\r\n')
    entry_output.append(enter(console, 'LIST'))
    console.expect_exact('Ready')
    listed = console.before.replace('\n\r', '\n').rstrip('\r\n').splitlines()[1:]
    assert listed == [line.expandtabs(8) for line in source], listed
    assert 'ILLEGAL VERB' not in ''.join(entry_output), entry_output

    answers = [answer for pair in sample['opening'] + sample['turns'] for answer in pair]
    win = play(console, answers, DECUS_MASK)
    # A new terminal RUN after the win must rewind DATA for the draw.
    draw = play(console, DRAW_ANSWERS, DECUS_MASK)
    assert boards(win) == sample['boards']
    assert 'SAME COORD. SET TO 0' in win
    assert boards(draw) == DRAW_BOARDS

    restart = '\nGAME OF COMPETITIVE LIFE'
    ending = 'OUT OF DATA at line 10'
    assert 'PLAYER 1 IS THE WINNER' + restart in win
    assert 'A DRAW GAME' + restart in draw
    return {
        'sourceUrl': DECUS_SOURCE_URL,
        'physicalLines': len(source),
        'numberedLines': sum(line[0].isdigit() for line in source),
        'coordinatePrompt': DECUS_MASK,
        'drawAnswers': DRAW_ANSWERS,
        'win': observation(win, ending),
        'drawAfterFreshRun': observation(draw, ending),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--disk', required=True, type=Path)
    parser.add_argument('--decus-source', type=Path, help='Archived DECUS RSTS-11-14 LIFE2.BAS')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    sample = json.loads((FIXTURES / 'life2-sample.json').read_text())
    if args.decus_source:
        data = args.decus_source.read_bytes()
        assert digest(data) == DECUS_SOURCE_SHA256, 'Unexpected DECUS source bytes'
        capture_source = capture_decus
    else:
        data = (FIXTURES / 'life2-mar75-reviewed.bas').read_bytes()
        assert digest(data) == sample['sourceSha256']
        capture_source = capture
    assert args.disk.stat().st_size == 2494464, 'Expected a raw RK05 disk before REFRESH'
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copyfile(args.disk, root / 'working.dsk')
        (root / 'boot.ini').write_text(
            'SET CPU 11/05\nSET CPU 64K\nSET CLK 60HZ\nSET RK ENABLED\n'
            'ATTACH RK0 working.dsk\nBOOT RK0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(args.simulator.resolve()), ['boot.ini'], cwd=directory, encoding='ascii', timeout=20,
        ) as console:
            boot(console)
            reference = capture_source(console, data.decode('ascii').splitlines(), sample)
    result = {
        'schemaVersion': 1,
        'simulatorCommit': SIMH_COMMIT,
        'build': BUILD,
        'sourceSha256': digest(data),
        **reference,
    }
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='ascii')
    print(f'Captured LIFE2 observations in {args.output}')


if __name__ == '__main__':
    main()
