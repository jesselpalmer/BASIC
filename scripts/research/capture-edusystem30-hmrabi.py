"""Capture a full HMRABI term and an impeachment on archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
PROMPTS = [
    'HOW MANY ACRES DO YOU WISH TO BUY?', 'HOW MANY ACRES DO YOU WISH TO SELL?',
    'HOW MANY BUSHELS DO YOU WISH TO FEED YOUR PEOPLE?',
    'HOW MANY ACRES DO YOU WISH TO PLANT WITH SEED?',
]
RUNS = [
    ('ten-year term with resource and labor retries', 1, [
        10000, 0, 10000, 0, 10000, 2000, 1001, 1000, 999,
        0, 0, 2100, 1000, 0, 0, 2200, 1000, 0, 0, 2460, 1000, 0, 0, 2640, 1000,
        0, 0, 2820, 1000, 0, 24, 1480, 730, 0, 73, 1600, 742, 0, 62, 1660, 768,
        0, 0, 1820, 841,
    ], [
        'IN YEAR 11 ', 'ONLY 100 PEOPLE TO TEND THE FIELDS', 'A HORRIBLE PLAGUE STRUCK!',
        ' 0 PEOPLE DIED!!', ' 16.82 ACRES PER PERSON.', 'A FANTASTIC PERFORMANCE!!!',
    ]),
    ('fresh run and impeachment after one year', 17, [0, 0, 1000, 0], [
        'YOU STARVED 50 PEOPLE IN ONE YEAR!!!', 'BEEN IMPEACHED AND THROWN OUT OF OFFICE',
    ]),
]


def capture_run(console, shared, clock_word, answers):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 02755')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('Breakpoint, PC: 02755')
    prefix = console.before.replace(TAPE_FLUSH, '')
    assert prefix.endswith('\r\n'), repr(prefix)
    chunks = [prefix.removesuffix('\r\n')]
    console.expect_exact('sim> ')
    console.sendline(f'deposit 7471 {clock_word:o}')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    prompts = []
    for index, answer in enumerate(answers):
        console.expect_exact([*PROMPTS, 'READY'])
        assert console.after in PROMPTS, repr(console.before + console.after)
        prompts.append(console.after)
        echoed_newline = '\n' if index else ''
        chunks.append(console.before.removeprefix(echoed_newline) + console.after)
        console.send(answer + '\r')
        console.expect_exact(answer + '\r')
    console.expect_exact('READY')
    tail = console.before.removeprefix('\n')
    assert tail.endswith('\x00\r\n'), repr(tail)
    chunks.append(tail.removesuffix('\x00\r\n'))
    output = ''.join(chunks).replace(TAPE_FLUSH, '').replace('\r\n', '\n')
    return prompts, output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = directory.parent / 'package/fixtures/classic'
    pinned_source = (fixtures / 'hmrabi.bas').read_bytes()
    source = (fixtures / 'hmrabi-edusystem30.bas').read_bytes()
    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, numbers, checks in RUNS:
            answers = list(map(str, numbers))
            prompts, output = capture_run(console, shared, clock_word, answers)
            assert all(check in output for check in checks), repr(output)
            assert output.count('\x07') == 10, repr(output)
            runs.append({
                'name': name, 'clockWord': clock_word, 'answers': answers,
                'prompts': prompts, 'output': output,
            })
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'pinnedSha256': shared['digest'](pinned_source),
        'fixtureSha256': shared['digest'](source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
