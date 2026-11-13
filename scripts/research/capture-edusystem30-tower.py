"""Capture TOWER source diagnostics, the printed game, and MARK replay on EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
SIZE = 'HOW MANY DISKS DO YOU WANT TO MOVE (7 IS MAX)?'
DISK = 'WHICH DISK WOULD YOU LIKE TO MOVE?'
NEEDLE = 'PLACE DISK ON WHICH NEEDLE?'
REPLAY = 'TRY ANOTHER ONE (Y OR N)\r\n'
REPLAY_RETRY = "'Y' OR 'N' PLEASE\r\n"
ILLEGAL_DISK = 'ILLEGAL ENTRY... YOU MAY ONLY TYPE 3,5,7,9,11,13, OR 15. \r\n?'


def moves(pairs):
    return [item for disk, needle in pairs for item in [(DISK, disk), (NEEDLE, needle)]]


PRINTED = [
    (SIZE, '3'), *moves([('11', '3'), ('13', '2'), ('11', '2'), ('15', '3'), ('11', '1')]),
    (DISK, '12'), (ILLEGAL_DISK, '13'), (NEEDLE, '3'), *moves([('11', '3')]),
]
TWO_DISKS = [(SIZE, '2'), *moves([('13', '2'), ('15', '3'), ('13', '3')]), (REPLAY, 'N')]
MAX_DISKS = [
    (SIZE, '0'), (SIZE, '8'), (SIZE, '7'), (DISK, '5'), *moves([('3', '2'), ('5', '2')]),
    *moves([('5', '4')]), (NEEDLE, '0'),
]
RUNS = [
    ('printed game, invalid replay response and two-disk replay',
     [*PRINTED, (REPLAY, 'Q'), (REPLAY_RETRY, 'Y'), *TWO_DISKS], 1390, [7, 3]),
    ('fresh two-disk game', TWO_DISKS, 1390, [3]),
    ('maximum size, blocked disks and repeated invalid needle', MAX_DISKS, 790, []),
    ('third invalid size stops before a board is shown', [(SIZE, '0'), (SIZE, '8'), (SIZE, '9')],
     320, []),
]
END_PROBES = [
    ('PRINT "AFTER"\\END', 'BEFORE\nAFTER\n'),
    ('END\\PRINT "AFTER"', 'BEFORE\n'),
    ('PRINT "DURING"\\END\\PRINT "AFTER"', 'BEFORE\nDURING\n'),
    ('PRINT "AFTER"', 'EN 20\n'),
]


def load(console, shared, source):
    console.delaybeforesend = 0.02
    for line in source.splitlines():
        if line:
            shared['send_line'](console, line)


def begin(console, shared):
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)


def after_ready(console, shared):
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH, '')
    assert tail.endswith('\n'), repr(tail)
    return tail[:-1]


def capture_rejection(console, shared, source, labels):
    load(console, shared, source)
    begin(console, shared)
    output = after_ready(console, shared)
    assert output == ''.join(f'S1 {label}\n' for label in labels), repr(output)
    return output


def capture_end(console, shared, body, expected):
    source = f'10 PRINT "BEFORE"\n20 {body}'
    load(console, shared, source)
    begin(console, shared)
    output = after_ready(console, shared)
    assert output == expected, repr(output)
    return {'source': source, 'output': output}


def capture_run(console, shared, name, responses, stop_label, move_counts):
    begin(console, shared)
    chunks = []
    for prompt, answer in responses:
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        if prompt in (REPLAY, REPLAY_RETRY):
            console.send(answer)
            console.expect_exact(answer)
            assert console.before == '', repr(console.before)
        else:
            shared['send_line'](console, answer)
    chunks.append(after_ready(console, shared))
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '')
    assert re.findall(r'CONGRATULATIONS!! YOU HAVE PERFORMED THE TASK IN (\d+) MOVES\.', output) == [
        str(count) for count in move_counts
    ], output
    return {
        'name': name,
        'answers': [answer for _, answer in responses],
        'moveCounts': move_counts,
        'haltLabel': stop_label,
        'outputSha256': shared['digest'](output.encode('ascii')),
    }, output


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
    raw = (fixtures / 'tower.bas').read_bytes()
    reviewed = (fixtures / 'tower-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'tower-mark-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert [line.split()[0] for line, alternate in zip(
        reviewed.splitlines(), adapted.splitlines(), strict=True
    ) if line != alternate] == [b'1150', b'1160', b'1170', b'1180']

    def reject(source, labels):
        with shared['edu30'](simulator, tape) as console:
            return capture_rejection(console, shared, source.decode('ascii'), labels)

    def play():
        with shared['edu30'](simulator, tape) as console:
            load(console, shared, adapted.decode('ascii'))
            return [capture_run(console, shared, *run) for run in RUNS]

    def probe_end(case):
        with shared['edu30'](simulator, tape) as console:
            return capture_end(console, shared, *case)

    with ThreadPoolExecutor(max_workers=7) as pool:
        raw_rejection = pool.submit(reject, raw, [800, 840, 880, 930, 1030, 1160, 1170, 1240])
        reviewed_rejection = pool.submit(reject, reviewed, [1160, 1170])
        games = pool.submit(play)
        end_probes = list(pool.map(probe_end, END_PROBES))
        runs, transcripts = zip(*games.result(), strict=True)

    printed_and_replay, fresh, maximum, invalid_size = transcripts
    assert printed_and_replay.split("'Y' OR 'N' PLEASE\n", 1)[1] == fresh
    assert printed_and_replay.count('ILLEGAL ENTRY...') == 1
    assert '***************' in printed_and_replay
    assert maximum.count("SORRY, BUT I CAN'T DO THAT JOB FOR YOU.") == 2
    assert 'THAT DISK IS BELOW ANOTHER ONE.' in maximum
    assert "YOU CAN'T PLACE A LARGER DISK ON TOP OF A SMALLER ONE." in maximum
    assert "I TRIED TO WARN YOU, BUT YOU WOULDN'T LISTEN." in maximum
    assert invalid_size.count("SORRY, BUT I CAN'T DO THAT JOB FOR YOU.") == 2
    assert "ALRIGHT, WISE GUY, IF YOU CAN'T PLAY THE GAME RIGHT, I'LL\n" in invalid_size
    assert 'JUST TAKE MY PUZZLE AND GO HOME.' in invalid_size

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawCompilerOutput': raw_rejection.result(),
        'reviewedCompilerOutput': reviewed_rejection.result(),
        'endProbes': end_probes,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
