"""Capture EVEN1 source rejection and complete MARK games on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
INSTRUCTIONS = 'DO YOU WANT INSTRUCTIONS (Y OR N)?'
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
CLOCK_WORD = 1744
RUNS = [
    ('six printed rounds, invalid retry and quit',
     ['Y', '5', '1', '3', '2', '4', '1', '1', '4', '1', '3', '2', '4', '4', '1', '3', '4', '1', '1', '0'],
     ['YOU WIN!!'] * 6),
    ('fresh opening, computer win and quit', ['N', '2', '1', '1', '0'], ['I WIN!!!']),
]
DIAGNOSTICS = (
    'S1 1\nPC 2\nS1 3\nS1 4\nS1 13\nS1 14\nS1 20\nS1 25\nS1 70\n'
    'S1 90\nPC 100\nS1 370\nS1 420\n'
)


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        shared['send_line'](console, line)
    console.delaybeforesend = 0.05


def reject(console, shared, source):
    load(console, shared, source)
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('\r\nREADY')
    output = shared['normalize'](console.before).replace(TAPE_NOTICE, '')
    assert output == DIAGNOSTICS, repr(output)
    return output


def command(console, text):
    console.sendline(text)
    console.expect_exact('sim> ')


def resume(console):
    console.sendline('continue')
    console.expect_exact('continue\r\n')


def capture_run(console, shared, name, answers, winners):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command(console, 'break 02755')
    resume(console)
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact(INSTRUCTIONS)
    chunks = [console.before + INSTRUCTIONS]
    console.send(answers[0])
    console.expect_exact(answers[0])
    assert console.before == '', repr(console.before)

    console.expect_exact('Breakpoint, PC: 02755')
    before_breakpoint = console.before
    assert before_breakpoint.endswith('\r\n'), repr(before_breakpoint)
    chunks.append(before_breakpoint[:-2])
    console.expect_exact('sim> ')
    command(console, f'deposit 7471 {CLOCK_WORD:o}')
    command(console, 'nobreak 02755')
    resume(console)

    for answer in answers[1:]:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        shared['send_line'](console, answer)
    console.expect_exact('\r\nREADY')
    chunks.append(console.before)
    output = shared['normalize'](''.join(chunks)).replace(TAPE_NOTICE, '')
    assert re.findall(r'GAME OVER \.\.\. (.*)$', output, re.M) == winners, repr(output)
    assert output.endswith('YOUR MOVE?'), repr(output)
    return {
        'name': name,
        'answers': answers,
        'winners': winners,
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
    raw = (fixtures / 'even1.bas').read_bytes()
    reviewed = (fixtures / 'even1-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'even1-mark-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert shared['digest'](raw) == 'de131e03bc803d2924ef5aba12abb2136cc38d7c2bd7efb41ac9b4d772bb7ae2'

    def rejection(source):
        with shared['edu30'](simulator, tape) as console:
            return reject(console, shared, source.decode('ascii'))

    with ThreadPoolExecutor(max_workers=2) as pool:
        rejections = list(pool.map(rejection, [raw, reviewed]))
    with shared['edu30'](simulator, tape) as console:
        load(console, shared, adapted.decode('ascii'))
        runs, (replay, fresh) = zip(
            *(capture_run(console, shared, *run) for run in RUNS), strict=True,
        )

    assert ' 5 IS AN ILLEGAL MOVE ... YOUR MOVE?' in replay
    assert 'THE GAME IS PLAYED AS FOLLOWS:' in replay
    assert 'THE GAME IS PLAYED AS FOLLOWS:' not in fresh
    # After a win, the retained table changes the computer's first move with 21 chips.
    assert re.search(r'^THERE ARE 21 CHIPS.*\nCOMPUTER TAKES 2 CHIPS LEAVING 19 ', replay, re.M)
    assert re.search(r'^THERE ARE 21 CHIPS.*\nCOMPUTER TAKES 4 CHIPS LEAVING 17 ', fresh, re.M)
    assert re.search(r'^THERE ARE 15 CHIPS.*\nCOMPUTER TAKES 4 CHIPS LEAVING 11 ', fresh, re.M)
    assert re.search(r'^THERE ARE 15 CHIPS.*\nCOMPUTER TAKES 2 CHIPS LEAVING 13 ', replay, re.M)
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawCompilerOutput': rejections[0],
        'reviewedCompilerOutput': rejections[1],
        'clockWord': CLOCK_WORD,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
