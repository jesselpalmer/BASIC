"""Capture GOMOKO source rejections and adapted play on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
SIZE = 'WHAT IS YOUR BOARD SIZE (MIN =7, MAX = 19)?'
MOVE = 'YOUR PLAY (I,J)?'
REPLAY = 'PLAY AGAIN (1 FOR YES, 0 FOR NO)?'
RUNS = [
    ('printed move sequence', [(SIZE, '8'), *[(MOVE, move) for move in (
        '4,4', '5,5', '3,3', '3,5', '5,3', '4,5', '4,3', '4,2', '4,5', '4,6', '-1,-1',
    )], (REPLAY, '0')], [8] * 9),
    ('invalid sizes, illegal and occupied moves, retained replay board', [
        (SIZE, '6'), (SIZE, '20'), (SIZE, '7'), (MOVE, '0,3'), (MOVE, '4,4'),
        (MOVE, '4,4'), (MOVE, '-1,-1'), (REPLAY, '1'), (SIZE, '7'),
        (MOVE, '4,4'), (MOVE, '-1,-1'), (REPLAY, '0'),
    ], [7]),
    ('maximum board and corner', [
        (SIZE, '19'), (MOVE, '19,19'), (MOVE, '-1,-1'), (REPLAY, '0'),
    ], [19]),
]


def begin(console, shared, source):
    console.delaybeforesend = 0.02
    for line in source.splitlines():
        shared['send_line'](console, line)
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)


def after_ready(console, shared):
    console.expect_exact('READY')
    output = shared['normalize'](console.before).replace(TAPE_FLUSH_NOTICE, '')
    assert output.endswith('\n')
    return output[:-1]


def capture_rejection(console, shared, source, labels):
    begin(console, shared, source)
    output = after_ready(console, shared)
    assert output == ''.join(f'S2 {label}\n' for label in labels), repr(output)
    return output


def capture_run(console, shared, source, name, responses, board_sizes):
    begin(console, shared, source)
    chunks = []
    for prompt, answer in responses:
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        shared['send_line'](console, answer)
    chunks.append(after_ready(console, shared))
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH_NOTICE, '')
    boards = [
        [row.split() for row in chunk.split('\n\n', 1)[0].splitlines()]
        for chunk in output.split(MOVE)[1:]
        if chunk.startswith(' 0 ') or chunk.startswith(' 1 ') or chunk.startswith(' 2 ')
    ]
    assert [len(board) for board in boards] == board_sizes, repr(output)
    assert all(len(row) == len(board) for board in boards for row in board), repr(output)
    assert output.endswith(REPLAY), repr(output)
    if name == RUNS[0][0]:
        assert boards[0][1][0] == '2' and boards[0][3][3] == '1'
        assert boards[-1][3][1:6] == ['1'] * 5
        assert output.count('SQUARE OCCUPIED. TRY AGAIN...') == 1
    elif name == RUNS[1][0]:
        assert output.count('THE MINIMUM SIZE IS 7') == 2
        assert output.count('ILLEGAL MOVE. TRY AGAIN...') == 1
        assert output.count('SQUARE OCCUPIED. TRY AGAIN...') == 2
        assert 'SQUARE OCCUPIED. TRY AGAIN...' in output.split(REPLAY, 1)[1]
    else:
        assert boards[0][18][18] == '1'
    return {
        'name': name,
        'answers': [answer for _, answer in responses],
        'boardSizes': board_sizes,
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
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    fixtures = directory.parent / 'package/fixtures/classic'
    raw = (fixtures / 'gomoko.bas').read_bytes()
    reviewed = (fixtures / 'gomoko-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'gomoko-edusystem30-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert adapted == reviewed.replace(b'\n110 ', b'\n100 DIM A(19,19)\n110 ', 1)

    def capture(case):
        with shared['edu30'](simulator, tape) as console:
            return capture_run(console, shared, adapted.decode('ascii'), *case)

    def reject(source, move_label):
        labels = [210, 410, 440, 580, 650, move_label, 810]
        with shared['edu30'](simulator, tape) as console:
            return capture_rejection(console, shared, source.decode('ascii'), labels)

    with ThreadPoolExecutor(max_workers=5) as pool:
        raw_rejection = pool.submit(reject, raw, 680)
        reviewed_rejection = pool.submit(reject, reviewed, 660)
        runs = list(pool.map(capture, RUNS))

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawCompilerOutput': raw_rejection.result(),
        'reviewedCompilerOutput': reviewed_rejection.result(),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
