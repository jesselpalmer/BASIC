"""Compare varying-Q FIPFOP on two archived BASIC-PLUS builds."""

import argparse
from importlib import import_module
import json
import math
from pathlib import Path
import shutil
import tempfile

import pexpect


fipfop = import_module('capture-fipfop-rsts')
life2 = import_module('capture-life2-rsts')
nicoma = import_module('capture-nicoma-rsts')

INPUTS = [
    '12', '0', '1', '1', '11', '3', '3', '4', '5', '6', '10',
    'YES', '10', '2', '2', '5', '8', '9', 'NO',
]
DRAWS = [25265, 25619, 24633]
EDGE_CASES = [(1, 8), (9, 9), (57, 3)]
FORMULAS = [
    '30 LET R=TAN(Q+N/Q-N)-SIN(Q/N)+336*SIN(.8*N)',
    '40 LET A=R-INT(R):LET A=INT(10*A)',
    '50 LET R=.592*(1/TAN(Q/N+Q))/SIN(N*2+Q)-COS(N)',
    '60 LET B=R-INT(R):LET B=INT(10*B)',
]
MAP_SOURCE = [
    '5 FOR J=1 TO 3',
    '10 LET Q=RND(Y):PRINT INT(Q*32768)',
    '20 FOR N=1 TO 10',
    *FORMULAS,
    '70 PRINT N;A;B',
    '80 NEXT N',
    '90 NEXT J',
    '100 END',
]
EDGE_SOURCE = [
    '5 FOR J=1 TO 3',
    '10 IF J=1 THEN 100',
    '11 IF J=2 THEN 110',
    '12 LET W=57:LET N=3:GOTO 20',
    '20 LET Q=W/32768',
    *FORMULAS,
    '70 PRINT W;N;A;B',
    '71 IF J<>1 THEN 80',
    '72 LET X=Q+N/Q-N',
    '73 PRINT X;X-262136;TAN(X)',
    '80 NEXT J',
    '90 END',
    '100 LET W=1:LET N=8:GOTO 20',
    '110 LET W=9:LET N=9:GOTO 20',
]


def rows(console, boot, source):
    fipfop.load(console, {'boot': boot}, source)
    console.expect_exact(fipfop.READY)
    return [list(map(int, line.split())) for line in console.before.splitlines() if line]


def secondary_positions(console, boot):
    output = rows(console, boot, MAP_SOURCE)
    assert len(output) == 33, output
    maps = []
    for offset, word in zip(range(0, len(output), 11), DRAWS, strict=True):
        assert output[offset] == [word], output
        values = output[offset + 1:offset + 11]
        assert [row[0] for row in values] == list(range(1, 11)), values
        assert all(0 <= position <= 9 for row in values for position in row[1:]), values
        maps.append({
            'qTimes32768': word,
            'ordinary': [row[1] for row in values],
            'repeated': [row[2] for row in values],
        })
    return maps


def compare_binary64(console, boot):
    fipfop.load(console, {'boot': boot}, EDGE_SOURCE)
    console.expect_exact(fipfop.READY)
    lines = console.before.splitlines()
    assert lines[1] == ' 262136  0  13.5567 ', lines
    output = [list(map(int, line.split())) for index, line in enumerate(lines) if index != 1 and line]
    assert [tuple(row[:2]) for row in output] == EDGE_CASES, output
    results = []
    for word, position, ordinary, repeated in output:
        q = word / 32768
        a = math.tan(q + position / q - position) - math.sin(q / position) + 336 * math.sin(.8 * position)
        b = .592 * (1 / math.tan(q / position + q)) / math.sin(position * 2 + q) - math.cos(position)
        binary64 = [int(10 * (value - math.floor(value))) for value in (a, b)]
        results.append({
            'qTimes32768': word,
            'move': position,
            'archive': [ordinary, repeated],
            'binary64': binary64,
        })
    assert all(row['archive'] != row['binary64'] for row in results), results
    return {
        'secondaryPositions': results,
        'tangentProbe': {
            'operand': 262136,
            'archivePrint': '13.5567',
            'binary64': math.tan(262136),
        },
    }


def replay(console, boot, source):
    fipfop.load(console, {'boot': boot}, source.splitlines())
    console.expect_exact(fipfop.NUMBER)
    output = [console.before + fipfop.NUMBER]
    for index, answer in enumerate(INPUTS):
        prompt = (
            fipfop.READY if answer == 'NO' else
            fipfop.REPLAY if index in (10, 17) else fipfop.NUMBER
        )
        text = fipfop.respond(console, answer, prompt)
        if index in (10, 17):
            assert fipfop.BOARD + 'O O O O O O O O O O \r\n' in text, text
            assert 'IN ONLY  6 GUESSES!!!!' in text, text
        elif index in (4, 11):
            assert fipfop.HEADING in text, text
        elif answer == 'NO':
            assert text == '\r\n', text
        output.append(text + (prompt if prompt != fipfop.READY else ''))
    return ''.join(output).replace('\r\n', '\n').removesuffix('\n')


def capture(simulator, disk, action, *args):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        shutil.copyfile(disk, path / 'working.dsk')
        (path / 'boot.ini').write_text(fipfop.BOOT, encoding='ascii')
        with pexpect.spawn(
            str(simulator), ['boot.ini'], cwd=directory, encoding='ascii', timeout=20,
        ) as console:
            return action(console, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--v4a-disk', required=True, type=Path)
    parser.add_argument('--v4b-disk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    reviewed = (fipfop.FIXTURES / 'fipfop-mar75-text.bas').read_bytes()
    assert life2.digest(reviewed) == fipfop.REVIEWED_SHA256
    assert args.v4a_disk.stat().st_size == 2494464
    assert nicoma.digest(args.v4b_disk.read_bytes()) == nicoma.DISK_SHA256
    source = reviewed.decode('ascii').replace(
        '180 RANDOMIZE', '180 REM DEFAULT RNG PROBE',
    ).replace('COT(Q/N+Q)', '(1/TAN(Q/N+Q))')
    captures = []
    for disk, boot in [(args.v4a_disk, life2.boot), (args.v4b_disk, nicoma.boot)]:
        captures.append({
            'secondaryPositions': capture(args.simulator.resolve(), disk, secondary_positions, boot),
            'binary64Comparison': capture(args.simulator.resolve(), disk, compare_binary64, boot),
            'output': capture(args.simulator.resolve(), disk, replay, boot, source),
        })
    first, second = captures
    assert first == second, captures
    args.output.write_text(json.dumps({
        'simulatorCommit': life2.SIMH_COMMIT,
        'builds': [life2.BUILD, nicoma.BUILD],
        'reviewedFixtureSha256': fipfop.REVIEWED_SHA256,
        'replaySourceSha256': life2.digest(source.encode('ascii')),
        'inputs': INPUTS,
        **first,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
