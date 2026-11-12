"""Reproduce the printed BOUNCE plot and replay on archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = 'a5010e3085220dfef1cf9d19c6c4a520c382c5e53df5d2076b11b3ad92c1b672'
SOURCE_SHA256 = '1d7c5e33c49274161ad71fd56f5bae691a66da3b6bf3e324968b5d305b88ce49'
PROMPTS = ['TIME INCREMENT (SEC)?', 'VELOCITY (FPS)?', 'COEFFICIENT?']
PRINTED = ['.1', '30', '.9']
REPLAY = ['.2', '24', '.6']


def load(console, shared, source):
    console.delaybeforesend = 0.02
    for line in source.decode('ascii').splitlines():
        shared['send_line'](console, line)


def capture_run(console, shared, answers):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for index, answer in enumerate(answers):
        prompt = PROMPTS[index % len(PROMPTS)]
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        send_line(console, answer)
    console.expect_exact(PROMPTS[0])
    chunks.append(console.before + PROMPTS[0])
    console.sendcontrol('c')
    console.expect_exact('READY')

    # Normalize terminal line endings. Backward TAB emits significant CR/NUL.
    return ''.join(chunks).replace(
        'DT0: writing buffer to file: working.tu56\r\n', ''
    ).replace('\r\n', '\n')


def paper_output(text):
    lines = []
    for line in text.split('\n'):
        initial, *returns = line.split('\r\x00')
        cells = dict(enumerate(initial))
        for overlay in returns:
            for column, mark in enumerate(overlay):
                if mark != ' ' or column not in cells:
                    cells[column] = mark
        lines.append(''.join(cells[column] for column in range(len(cells))))
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    sim = args.simulator.resolve()
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    raw = (fixtures / 'bounce.bas').read_bytes()
    source = (fixtures / 'bounce-mar75-text.bas').read_bytes()
    assert shared['digest'](raw) == RAW_SHA256
    assert shared['digest'](source) == SOURCE_SHA256

    with shared['edu30'](sim, tape) as console:
        load(console, shared, raw)
        shared['send_line'](console, 'RUN')
        console.expect_exact('READY')
        assert re.findall(r'^UL \d+$', shared['normalize'](console.before), re.M) == ['UL 135']

    with shared['edu30'](sim, tape) as console:
        load(console, shared, source)
        printed_then_replay = capture_run(console, shared, [*PRINTED, *REPLAY])
        fresh = capture_run(console, shared, REPLAY)

    intro, printed, replay = printed_then_replay.split(PROMPTS[0])[:3]
    assert printed_then_replay.endswith(PROMPTS[0])
    assert fresh == intro + PROMPTS[0] + replay + PROMPTS[0]
    for plot, highest, seconds in [(printed, 14, 6), (replay, 9, 5)]:
        assert '\r\x00' in plot
        graph, _, axis = plot.partition('\n . . ')
        assert [int(label) for label in re.findall(r'^ (\d+) ', graph, re.M)] == list(
            range(highest, -1, -1)
        )
        assert re.findall(r'^ 0 +([1-9][ 1-9]+) $', axis, re.M)[0].split() == [
            str(second) for second in range(1, seconds + 1)
        ]
        assert 'SECONDS\n' in axis
    assert '\n 14      OOO\n            O\n' in printed

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'rawDiagnostic': 'UL 135',
        'fixtureSha256': SOURCE_SHA256,
        'runs': [
            {
                'answers': answers,
                'outputSha256': shared['digest'](output.encode('ascii')),
                'paperOutputSha256': shared['digest'](paper_output(output).encode('ascii')),
            }
            for answers, output in [
                ([*PRINTED, *REPLAY], printed_then_replay),
                (REPLAY, fresh),
            ]
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
