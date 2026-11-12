"""Capture the reviewed GOLF listing and prerequisite probes from archived EDU30.SV."""

import argparse
import json
import re
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


SOURCE_SHA256 = 'b6a6f7810e7f648aaae559e150ece86360532d8d33d08478e2fbca49f4f10d50'
RAW_SHA256 = 'e6eb8ea402a4fab51cdd62de4d42ca33ced97c74fd0efcc9fd886ffe66f15fce'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
DIRECTIONS = 'DO YOU WANT DIRECTIONS Y FOR YES N FOR NO\r\n'
PLAYERS = 'HOW MANY PLAYERS ARE PLAYING TODAY?'
HOLES = 'HOW MANY HOLES UP TO 18 DO YOU WANT TO PLAY?\r\n?'
RUNS = [
    {
        'name': 'two players with count retry and rough',
        'clockWord': 0,
        'instructions': 'N',
        'players': ['5', '2'],
        'holes': '2',
        'clubs': ['1', '3', '9', '1', '5', '9', '1', '1', '6', '9', '1', '1', '7', '8', '9'],
        'strokes': [9, 11],
        'par': 9,
        'markers': ['ONLY FOUR ARE ALLOWED TO PLAY AT ONE TIME', 'IN ROUGH'],
    },
    {
        'name': 'directions, trap and water',
        'clockWord': 660,
        'instructions': 'Y',
        'players': ['1'],
        'holes': '2',
        'clubs': ['1', '5', '8', '9', '1', '8', '8', '8', '1', '3', '7', '8'],
        'strokes': [11],
        'par': 9,
        'markers': ['DIRECTIONS FOR GOLF', 'IN TRAP', 'STILL IN TRAP', 'IN WATER',
                    'YOU LOSE 1 STROKE', 'YOU SUNK THE SHOT'],
    },
]
PROBES = [
    ('marked character literals', [
        '10 PRINT #A;#J;#K;#N;#Q;#T;#Y;#Z',
        '20 PRINT #9;##;#!', '30 END',
    ], ' 193  202  203  206  209  212  217  218 \n 185  163  161 \n'),
    ('numeric DATA and indexed READ', [
        '10 DATA 1.8,0,-2,3E-2', '20 DIM A(4)', '30 READ A(1)\\READ B',
        '40 READ A(2),A(3)', '50 PRINT A(1);B;A(2);A(3)', '60 END',
    ], ' 1.8  0 -2  3E-2 \n'),
    ('DATA uses the compiled source conversion', [
        '10 DATA 1.8,- 1.8,0.03,.51', '20 READ A,B,C,D',
        '30 PRINT A-1.8;B+1.8;C-.03;D-.51', '40 END',
    ], ' 0  0  0  0 \n'),
    ('DATA rejects an explicit leading plus', [
        '10 DATA +1.8', '20 READ A', '30 END',
    ], 'S1 10\n'),
    ('a skipped DATA statement is available', [
        '10 GOTO 30', '20 DATA 3,1', '30 READ A', '40 READ B',
        '50 PRINT A;B', '60 END',
    ], ' 3  1 \n'),
    ('READ exhaustion halts execution', [
        '10 DATA 1', '20 READ A', '30 READ A', '40 PRINT "STILL";A', '50 END',
    ], '\nERROR DA AT LINE 0030\n'),
    ('two-dimensional arrays', [
        '10 DIM M(4,18)', '20 LET M(4,18)=3', '30 LET M(0,0)=7',
        '40 LET M(1,2)=9', '50 PRINT M(4,18);M(0,0);M(1,2);M(2,1);M(0,18)', '60 END',
    ], ' 3  7  9  0  0 \n'),
    ('two-dimensional index bounds', [
        '10 DIM M(4,18)', '20 PRINT M(4.5,18.5)', '30 PRINT M(0,-.5)', '40 END',
    ], ' 0 \n\nERROR SS AT LINE 0030\n'),
]
PARITY_SOURCE = [
    '10 PRINT "LETTER"', '20 INPUT $A', '30 PRINT A;#Y;#N',
    '40 IF A=#N THEN 60', '50 PRINT "DIRECTIONS"', '60 END',
]


def compact(line):
    return '"'.join(piece if index % 2 else piece.replace(' ', '')
                    for index, piece in enumerate(line.split('"')))


def after_ready(console, shared):
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH, '')
    assert tail.endswith('\n\n'), repr(tail)
    return tail[:-1]


def start(console, shared, lines):
    console.delaybeforesend = 0
    for line in lines:
        shared['send_line'](console, line)


def capture_game(console, shared, source, run):
    send_line = shared['send_line']
    start(console, shared, map(compact, source.splitlines()))
    send_line(console, 'NOLINE')
    console.expect_exact('READY')

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    console.delaybeforesend = 0.05
    send_line(console, 'RUN')
    console.expect_exact('Breakpoint, PC: 02755')
    console.expect_exact('sim> ')
    command(f"deposit 7471 {run['clockWord']:o}")
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    console.expect_exact(DIRECTIONS)
    console.send(run['instructions'])
    console.expect_exact(run['instructions'])
    assert console.before == '', repr(console.before)
    chunks = [DIRECTIONS]
    prompts = [PLAYERS] * len(run['players']) + [HOLES] + ['?'] * len(run['clubs'])
    answers = [*run['players'], run['holes'], *run['clubs']]
    for prompt, answer in zip(prompts, answers, strict=True):
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        send_line(console, answer)
    chunks.append(after_ready(console, shared))
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '')
    scores = re.findall(r'^PLAYER NUMBER (\d+) SHOT (\d+) FOR (\d+) HOLES +PAR IS (\d+) $',
                        output, re.M)
    assert scores == [
        (str(player), str(strokes), run['holes'], str(run['par']))
        for player, strokes in enumerate(run['strokes'], 1)
    ], output
    assert all(marker in output for marker in run['markers']), output
    if run['instructions'] == 'N':
        assert 'DIRECTIONS FOR GOLF' not in output, output
    return {
        'name': run['name'],
        'clockWord': run['clockWord'],
        'answers': [run['instructions'], *answers],
        'strokes': run['strokes'],
        'par': run['par'],
        'outputSha256': shared['digest'](output.encode('ascii')),
    }


def capture_probe(console, shared, name, lines, expected):
    start(console, shared, lines)
    shared['send_line'](console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    output = after_ready(console, shared)
    assert output == expected, (name, repr(output))
    return {'name': name, 'source': '\n'.join(lines), 'output': output}


def capture_parity(console, shared, space):
    start(console, shared, PARITY_SOURCE)
    shared['send_line'](console, 'RUN')
    console.expect_exact('LETTER\r\n')
    console.send('N')
    console.expect_exact('N')
    assert console.before == '', repr(console.before)
    output = after_ready(console, shared)
    expected = ' 78  217  206 \nDIRECTIONS\n' if space else ' 206  217  206 \n'
    assert output == expected, repr(output)
    return {'parity': 'space' if space else 'mark', 'output': output}


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
    raw = (fixtures / 'golf.bas').read_bytes()
    reviewed = (fixtures / 'golf-mar75-text.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert shared['digest'](raw) == RAW_SHA256
    assert shared['digest'](reviewed) == SOURCE_SHA256

    def capture(run):
        with shared['edu30'](simulator, tape) as console:
            return capture_game(console, shared, reviewed.decode('ascii'), run)

    with ThreadPoolExecutor(max_workers=len(RUNS)) as pool:
        runs = list(pool.map(capture, RUNS))
    probes, parity = [], []
    for name, source, output in PROBES:
        with shared['edu30'](simulator, tape) as console:
            probes.append(capture_probe(console, shared, name, source, output))
    for space in (False, True):
        with shared['edu30'](simulator, tape, space_parity=space) as console:
            parity.append(capture_parity(console, shared, space))

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'runs': runs,
        'probes': probes,
        'characterInputParity': {'source': '\n'.join(PARITY_SOURCE), 'answer': 'N', 'runs': parity},
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
