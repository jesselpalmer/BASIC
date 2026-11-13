"""Capture HI-LO source diagnostics and MARK playthroughs on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
GUESS = 'YOUR GUESS?'
REPLAY = 'PLAY AGAIN (Y OR N)?'
RUNS = [
    {
        'name': 'clues, cumulative wins, six misses, reset and quit',
        'clockWord': 0,
        'answers': ['0', '90', '22', 'Y', '26', 'Y', '0', '1', '2', '50', '51', '52',
                    'Y', '78', 'N'],
        'wins': [22, 26, 78],
        'totals': [22, 48, 78],
        'missed': [36],
    },
    {
        'name': 'fresh zero jackpot and quit',
        'clockWord': 17,
        'answers': ['0', 'N'],
        'wins': [0],
        'totals': [0],
        'missed': [],
    },
]


def load(console, shared, source):
    console.delaybeforesend = 0.05
    for line in source.decode('ascii').splitlines():
        shared['send_line'](console, line)


def finish(console, shared):
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH, '')
    assert tail.endswith('\n'), repr(tail)
    return tail[:-1]


def reject(console, shared, source, expected):
    load(console, shared, source)
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    output = finish(console, shared)
    assert output == expected, repr(output)
    return output


def play(console, shared, seed, run):
    seed(console, shared, run['clockWord'])
    chunks = []
    for answer in run['answers']:
        character = answer in ['Y', 'N']
        prompt = REPLAY if character else GUESS
        console.expect_exact([GUESS, REPLAY])
        assert console.after == prompt, repr(console.before + console.after)
        chunks.append(console.before + prompt)
        if character:
            console.send(answer)
            console.expect_exact(answer)
            assert console.before == '', repr(console.before)
        else:
            shared['send_line'](console, answer)
    tail = finish(console, shared)
    assert tail == '\nSO LONG.  HOPE YOU ENJOYED YOURSELF!!\n', repr(tail)
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '') + tail
    assert [int(n) for n in re.findall(r'YOU WIN (\d+) DOLLARS\.', output)] == run['wins']
    assert [int(n) for n in re.findall(r'TOTAL WINNINGS ARE NOW (\d+) DOLLARS\.', output)] == run['totals']
    assert [int(n) for n in re.findall(r'THE NUMBER WAS (\d+) ', output)] == run['missed']
    if run['missed']:
        assert output.count('YOUR GUESS IS TOO LOW') == 4, repr(output)
        assert output.count('YOUR GUESS IS TOO HIGH') == 4, repr(output)
    return {**run, 'outputSha256': shared['digest'](output.encode('ascii'))}


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
    raw = (fixtures / 'hi-lo.bas').read_bytes()
    reviewed = (fixtures / 'hi-lo-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'hi-lo-mark-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert shared['digest'](raw) == '9d579faa15340c3b2eccae30ccfe3f0bb1ec0530b47e150617e5de7201337608'

    def rejected(source, expected):
        with shared['edu30'](simulator, tape) as console:
            return reject(console, shared, source, expected)

    def run_games():
        with shared['edu30'](simulator, tape) as console:
            load(console, shared, adapted)
            return [play(console, shared, seed, run) for run in RUNS]

    with ThreadPoolExecutor(max_workers=3) as pool:
        raw_compiler = pool.submit(rejected, raw, 'S1 180\nPC 200\nUQ 280\nS1 360\n')
        reviewed_compiler = pool.submit(rejected, reviewed, 'S1 180\nPC 200\nS1 360\n')
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
