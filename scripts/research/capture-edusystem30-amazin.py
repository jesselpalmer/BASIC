"""Capture the stock EDU30.SV memory diagnostic and two bounded AMAZIN mazes."""

import argparse
import json
import re
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


FIXTURES = Path('scripts/package/fixtures/classic')
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
PROMPT = 'WHAT ARE YOUR WIDTH AND LENGTH?\r\n?'
RUNS = [
    {'clockWord': 2, 'answers': ['1,1', '9,7'], 'width': 9, 'length': 7},
    {'clockWord': 113, 'answers': ['5,4'], 'width': 5, 'length': 4},
]


def compact(line):
    return '"'.join(piece if index % 2 else piece.replace(' ', '')
                    for index, piece in enumerate(line.split('"')))


def load(console, shared, source):
    console.delaybeforesend = 0
    for line in source.splitlines():
        shared['send_line'](console, compact(line))


def capture_memory_failure(console, shared, source):
    load(console, shared, source)
    shared['send_line'](console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('READY')
    output = shared['normalize'](console.before).replace(TAPE_FLUSH, '').strip()
    assert output == 'M1 1073', output
    return output


def seed(console, shared, clock_word):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 02755')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    console.delaybeforesend = 0.05
    shared['send_line'](console, 'RUN')
    console.expect_exact('Breakpoint, PC: 02755')
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {clock_word:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')


def verify_maze(output, width, length):
    rows = output.splitlines()[-(2 * length + 1):]
    assert len(rows) == 2 * length + 1
    for row in rows[::2]:
        assert re.fullmatch(r':(?:(?:--|  ):){%d}' % width, row), repr(row)
    for row in rows[1::2]:
        assert re.fullmatch(r'I(?:(?:  I|   )){%d}' % width, row), repr(row)
        assert row.endswith('I'), repr(row)

    def open_horizontally(wall_row, x):
        return rows[2 * wall_row][3 * x + 1:3 * x + 3] == '  '

    assert sum(open_horizontally(0, x) for x in range(width)) == 1
    assert sum(open_horizontally(length, x) for x in range(width)) == 1

    def neighbors(x, y):
        if y > 0 and open_horizontally(y, x):
            yield x, y - 1
        if y < length - 1 and open_horizontally(y + 1, x):
            yield x, y + 1
        if x > 0 and rows[2 * y + 1][3 * x] == ' ':
            yield x - 1, y
        if x < width - 1 and rows[2 * y + 1][3 * (x + 1)] == ' ':
            yield x + 1, y

    start = (next(x for x in range(width) if open_horizontally(0, x)), 0)
    visited = {start}
    pending = [start]
    degree_sum = 0
    while pending:
        for neighbor in neighbors(*pending.pop()):
            degree_sum += 1
            if neighbor not in visited:
                visited.add(neighbor)
                pending.append(neighbor)
    assert len(visited) == width * length
    assert degree_sum == 2 * (len(visited) - 1)
    return rows


def capture_game(console, shared, source, run):
    load(console, shared, source)
    seed(console, shared, run['clockWord'])
    chunks = []
    for answer in run['answers']:
        console.expect_exact(PROMPT)
        chunks.append(console.before + PROMPT)
        shared['send_line'](console, answer)
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH, '')
    assert tail.endswith('\n\n'), repr(tail)
    output = shared['normalize'](''.join(chunks)) + tail[:-1]
    assert output.count('WHAT ARE YOUR WIDTH AND LENGTH?\n?') == len(run['answers'])
    assert ('MEANINGLESS DIMENSIONS, TRY AGAIN' in output) == (len(run['answers']) == 2)
    rows = verify_maze(output, run['width'], run['length'])
    return {
        **run,
        'rows': rows,
        'outputSha256': shared['digest'](output.encode('ascii')),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    raw, reviewed, adapted = [
        (root / FIXTURES / name).read_bytes()
        for name in ['amazin.bas', 'amazin-mar75-text.bas', 'amazin-edu30-adapted.bas']
    ]
    assert adapted == reviewed.replace(b'110 DIM W(25,103),V(25,103)', b'110 DIM W(9,7),V(9,7)')
    assert adapted != reviewed

    def capture_failure(source):
        with shared['edu30'](simulator, tape) as console:
            return capture_memory_failure(console, shared, source.decode('ascii'))

    def capture_run(run):
        with shared['edu30'](simulator, tape) as console:
            return capture_game(console, shared, adapted.decode('ascii'), run)

    with ThreadPoolExecutor(max_workers=4) as executor:
        raw_failure = executor.submit(capture_failure, raw)
        reviewed_failure = executor.submit(capture_failure, reviewed)
        runs = [executor.submit(capture_run, run) for run in RUNS]
        evidence = {
            'simulatorCommit': shared['SIMULATOR'],
            'tapeSha256': shared['TAPE_SHA256'],
            'rawFixtureSha256': shared['digest'](raw),
            'reviewedFixtureSha256': shared['digest'](reviewed),
            'fixtureSha256': shared['digest'](adapted),
            'rawDiagnostic': raw_failure.result(),
            'reviewedDiagnostic': reviewed_failure.result(),
            'runs': [run.result() for run in runs],
        }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
