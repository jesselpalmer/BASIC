"""Capture the March 1975 MUGWUMP listing on archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = '55d681394e56370b0dc89dd00d806fad3dc6fd22247ac17b71ccdb891aac47d3'
SOURCE_SHA256 = 'd4eb08bee26393dc1db3988bf71520d6410efaaf3da1ce0a9575f58aeaa75c66'
CLOCK_WORD = 0
PROMPT = 'WHAT IS YOUR GUESS?'
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
WIN = ['0,0', '2,7', '2,7', '2,5', '3,6', '7,7']
LOSS = ['1,4', *(['0,0'] * 9)]


def capture_run(console, shared, answers):
    send_line = shared['send_line']

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')
        return shared['normalize'](console.before)

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('Breakpoint, PC: 02755')
    prefix = console.before
    assert prefix.endswith('\r\n'), repr(prefix)
    chunks = [prefix[:-2]]
    console.expect_exact('sim> ')
    assert re.search(r'150:\s+1461\n151:\s+3007', command('examine 150-151'))
    command(f'deposit 7471 {CLOCK_WORD:o}')
    command('nobreak 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    for answer in answers:
        console.expect_exact(PROMPT)
        chunks.append(console.before + PROMPT)
        send_line(console, answer)
    console.expect_exact(PROMPT)
    chunks.append(console.before + PROMPT)
    console.sendcontrol('c')
    console.expect_exact('READY')
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
    raw = (fixtures / 'mugwump.bas').read_bytes()
    source = (fixtures / 'mugwump-mar75-text.bas').read_bytes()
    assert shared['digest'](raw) == RAW_SHA256
    assert shared['digest'](source) == SOURCE_SHA256
    runs = [WIN + LOSS, WIN]

    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        combined, fresh = (capture_run(console, shared, answers) for answers in runs)

    assert combined.startswith(fresh), (repr(combined), repr(fresh))
    assert fresh.count('YOU HAVE FOUND MUGWUMP') == 4, repr(fresh)
    assert 'YOU GOT THEM ALL IN 6 TURNS!' in fresh, repr(fresh)
    assert 'SORRY, THAT\'S 10 TRIES.' in combined, repr(combined)
    assert combined.count('YOU HAVE FOUND MUGWUMP') == 5, repr(combined)
    assert combined.count('IS AT (') == 3, repr(combined)
    assert combined.endswith('TURN NO.  1 WHAT IS YOUR GUESS?'), repr(combined)

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'clockWord': CLOCK_WORD,
        'runs': [
            {
                'answers': answers,
                'outputSha256': shared['digest'](output.encode('ascii')),
            }
            for answers, output in zip(runs, (combined, fresh), strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
