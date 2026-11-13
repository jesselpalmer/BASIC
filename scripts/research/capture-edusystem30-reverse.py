"""Capture REVERSE compiler diagnostics and MARK playthroughs on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
RULES = 'DO YOU WANT THE RULES (Y OR N)?'
MOVE = 'HOW MANY SHALL I REVERSE?'
REPLAY = 'TRY AGAIN (Y OR N)?'
BOARD = re.compile(r'^ (?:[1-9]  ){8}[1-9] $', re.MULTILINE)


def load(console, shared, source):
    console.delaybeforesend = 0.02
    for line in source.decode('ascii').splitlines():
        shared['send_line'](console, line)


def finish(console, shared):
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH, '')
    assert tail.endswith('\n'), repr(tail)
    return tail[:-1]


def reject(console, shared, source, rule_label):
    load(console, shared, source)
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    output = finish(console, shared)
    expected = f'PC 160\nS1 {rule_label}\nS1 210\nPC 220\nS1 230\nPC 240\nPC 530\nS1 550\nUL 520\n'
    assert output == expected, repr(output)
    return output


def next_board(output):
    boards = BOARD.findall(output)
    assert len(boards) == 1, repr(output)
    board = [int(token) for token in boards[0].split()]
    assert sorted(board) == list(range(1, 10)), board
    return board


def sort_moves(opening):
    working = opening[:]
    for target in range(9, 1, -1):
        index = working.index(target)
        if index == target - 1:
            continue
        if index:
            size = index + 1
            working[:size] = reversed(working[:size])
            yield size
        working[:target] = reversed(working[:target])
        yield target
    assert working == list(range(1, 10)), working


def play(console, shared, seed, clock_word, solve):
    seed(console, shared, clock_word)
    chunks = []
    answers = []
    boards = []

    def prompt(text):
        console.expect_exact(text)
        chunk = console.before
        chunks.append(chunk + text)
        return shared['normalize'](chunk).replace(TAPE_FLUSH, '')

    def reply(text, character=False):
        answers.append(text)
        if character:
            console.send(text)
            console.expect_exact(text)
            assert console.before == '', repr(console.before)
        else:
            shared['send_line'](console, text)

    prompt(RULES)
    reply('Y' if solve else 'N', character=True)
    opening_output = prompt(MOVE)
    assert ("THIS IS THE GAME OF 'REVERSE'." in opening_output) == solve
    opening = next_board(opening_output)
    boards.append(opening)

    moves = list(sort_moves(opening)) if solve else []
    if solve:
        reply('10')
        assert 'OOPS! TOO MANY' in prompt(MOVE)
        # A one-item reversal is a printed sample move and counts toward the win.
        moves.insert(0, 1)
        previous = opening
        for index, move in enumerate(moves):
            reply(str(move))
            won = index == len(moves) - 1
            output = prompt(REPLAY if won else MOVE)
            board = next_board(output)
            assert board == previous[:move][::-1] + previous[move:], (move, previous, board)
            boards.append(board)
            previous = board
            if won:
                assert f'YOU WON IT IN {len(moves)} MOVES !!!' in output, repr(output)
        reply('Y', character=True)
        replay = next_board(prompt(MOVE))
        assert replay != opening, replay
        boards.append(replay)

    reply('0')
    ending = finish(console, shared)
    assert ending == '\nO.K.   HOPE YOU HAD FUN!!\n', repr(ending)
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '') + ending
    return {
        'name': 'rules, invalid move, win, replay, and quit' if solve else 'fresh run without rules',
        'clockWord': clock_word,
        'answers': answers,
        'boards': boards,
        'outputSha256': shared['digest'](output.encode('ascii')),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    seed = runpy.run_path(str(directory / 'capture-edusystem30-amazin.py'))['seed']
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    fixtures = directory.parent / 'package/fixtures/classic'
    raw = (fixtures / 'reverse.bas').read_bytes()
    reviewed = (fixtures / 'reverse-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'reverse-mark-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert shared['digest'](raw) == 'e52d0bafedfdc5040b9fe0997a38c41553f6b1669b5b9821b651b3c249ecdd7a'

    def rejected(source, label):
        with shared['edu30'](simulator, tape) as console:
            return reject(console, shared, source, label)

    def run_games():
        with shared['edu30'](simulator, tape) as console:
            load(console, shared, adapted)
            return [
                play(console, shared, seed, 0, True),
                play(console, shared, seed, 113, False),
            ]

    with ThreadPoolExecutor(max_workers=3) as pool:
        raw_compiler = pool.submit(rejected, raw, 170)
        reviewed_compiler = pool.submit(rejected, reviewed, 180)
        runs = pool.submit(run_games)
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawCompilerOutput': raw_compiler.result(),
        'reviewedCompilerOutput': reviewed_compiler.result(),
        'runs': runs.result(),
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
