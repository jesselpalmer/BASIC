"""Replay the reviewed CHOMP listing in stock archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


RAW_SHA256 = '03500272496fb39a1aacc0137c44000f08804698d43a0387cb16265b6ac27a55'
SOURCE_SHA256 = '6749ee5fe345ce8a54c87b8618e65b1d6533d58da75b106cd3244a54c8a33330'
RUNS = [
    ('printed game and replay', [
        '1', '2', '4', '7', '4,6', '3,3', '1,4', '3,1', '2,3', '1,3', '2,2',
        '1,2', '2,1', '3,1', '1,1', '1', '2', '1', '1', '1,1', '0',
    ]),
    ('fresh three-player game with dimension and move retries', [
        '0', '3', '10', '2', '10', '2', '3,2', '2,2', '1,2', '2,1', '1,1', '0',
    ]),
]
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
HEADER = '       1 2 3 4 5 6 7 8 9\n'


def capture_game(console, shared, answers):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('\r\nREADY')
    chunks.append(console.before)
    return shared['normalize'](''.join(chunks)).replace(TAPE_NOTICE, '')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    assert shared['digest']((fixtures / 'chomp.bas').read_bytes()) == RAW_SHA256
    source = (fixtures / 'chomp-mar75-text.bas').read_bytes()
    assert shared['digest'](source) == SOURCE_SHA256
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        outputs = [capture_game(console, shared, answers) for _, answers in RUNS]
    printed, fresh = outputs
    assert printed.count(HEADER) == 12, repr(printed)
    assert ' 4     * * * * * \n' in printed and ' 4     \n' in printed
    assert 'NO FAIR.' in printed and 'YOU LOSE, PLAYER  2 ' in printed
    assert printed.count('HERE WE GO...') == 2 and 'YOU LOSE, PLAYER  1 ' in printed
    assert 'TOO MANY ROWS' in fresh and 'TOO MANY COLUMNS' in fresh and 'NO FAIR.' in fresh
    assert 'PLAYER  3 \n' in fresh and 'YOU LOSE, PLAYER  1 ' in fresh
    for output in outputs:
        assert output.endswith('AGAIN (1=YES; 0=NO!)?'), repr(output)
    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'runs': [
            {'name': name, 'answers': answers, 'outputSha256': shared['digest'](output.encode('ascii'))}
            for (name, answers), output in zip(RUNS, outputs, strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
