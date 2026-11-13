"""Capture the reviewed ROCKSP rejection and standalone adaptation in EDU30.SV."""

import argparse
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\r\n'
DIAGNOSTICS = ['S1 20', 'PC 25', 'LI 30', 'S1 32', 'S1 40', 'S1 105', 'S1 140']
RUNS = [
    {
        'name': 'ten-round sample reconstruction',
        'clockWord': 3720,
        'answers': ['20', '10', '1', '2', '3', '1', '1', '3', '3', '2', '3', '1'],
        'choices': ['PAPER', 'ROCK', 'SISSORS', 'SISSORS', 'ROCK',
                    'PAPER', 'ROCK', 'PAPER', 'SISSORS', 'SISSORS'],
        'score': [4, 4, 2],
    },
    {
        'name': 'fresh run with invalid move retry',
        'clockWord': 3720,
        'answers': ['3', '8', '1', '2', '3'],
        'choices': ['PAPER', 'ROCK', 'SISSORS'],
        'score': [1, 1, 1],
    },
]


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.decode('ascii').splitlines():
        shared['send_line'](console, line)


def capture(console, shared, run):
    send_line = shared['send_line']

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755')
    console.sendline('continue')
    send_line(console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('Breakpoint, PC: 02755')
    chunks = [console.before.removesuffix('\r\n')]
    console.expect_exact('sim> ')
    command(f"deposit 7471 {run['clockWord']:o}")
    command('nobreak 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    for answer in run['answers']:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('\r\nREADY')
    chunks.append(console.before)
    output = shared['normalize'](''.join(chunks).replace(TAPE_NOTICE, ''))
    return output


def verify(output, run):
    assert re.findall(r'^\.\.\.(PAPER|SISSORS|ROCK)$', output, re.M) == run['choices'], repr(output)
    computer, player, ties = run['score']
    assert f'I HAVE WON {computer} GAME(S).\nYOU HAVE WON {player} GAME(S).\n' in output
    assert f'AND {ties} GAME(S) ENDED IN A TIE.' in output
    assert output.count('WOW!  I WIN!!\n') == computer
    assert output.count('YOU WIN!!!\n') == player
    assert output.count('TIE GAME, NO WINNER.\n') == ties
    assert ('INVALID\n' in output) == ('8' in run['answers'])
    assert ("SORRY, BUT WE AREN'T ALLOWED TO PLAY THAT MANY." in output) == ('20' in run['answers'])
    assert output.endswith('THANKS FOR PLAYING!!\n'), repr(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    sim, tape = args.simulator.resolve(), args.tape.resolve()
    digest = shared['digest']
    assert digest(tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    raw = (fixtures / 'rocksp.bas').read_bytes()
    assert digest(raw) == '6c777ca8abec29f04c3d3588ba03301f7e0eb27d9e39621b2489f5a3d6f3cb6b'
    reviewed = (fixtures / 'rocksp-mar75-text.bas').read_bytes()
    source = (fixtures / 'rocksp-edusystem30.bas').read_bytes()

    for candidate in [raw, reviewed]:
        with shared['edu30'](sim, tape) as console:
            load(console, shared, candidate)
            shared['send_line'](console, 'RUN')
            console.expect_exact(BANNER)
            console.expect_exact('\r\nREADY')
            diagnostic = shared['normalize'](console.before).splitlines()
            assert diagnostic == DIAGNOSTICS, repr(diagnostic)

    runs = []
    with shared['edu30'](sim, tape) as console:
        load(console, shared, source)
        for run in RUNS:
            output = capture(console, shared, run)
            verify(output, run)
            runs.append({**run, 'outputSha256': digest(output.encode('ascii'))})

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': digest(raw),
        'reviewedFixtureSha256': digest(reviewed),
        'fixtureSha256': digest(source),
        'compilerDiagnostics': DIAGNOSTICS,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
