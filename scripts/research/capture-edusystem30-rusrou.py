"""Replay RUSROU's source-corrected threshold on archived EDU30.SV."""

import argparse
import json
from pathlib import Path
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
RUNS = [
    ('eleven pulls survive, then loss and give up', 46, ['1'] * 12 + ['2']),
    ('fresh run, give up and first-pull loss', 100, ['2', '1', '1', '1']),
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
    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        shared['send_line'](console, answer)
    console.expect_exact('?')
    chunks.append(console.before + '?')
    return ''.join(chunks).replace(TAPE_FLUSH, '').replace('\r\n', '\n')


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
    pinned = (fixtures / 'rusrou.bas').read_bytes()
    source = (fixtures / 'rusrou-edusystem30.bas').read_bytes()
    assert shared['digest'](pinned) == '4243d3c6759e9a2b78133ba26ccd1bedd65cad74332a4eed10607daa2f61b8be'
    assert source == pinned.replace(b'RND(0)>83333', b'RND(0)>.83333') + b'\n'
    runs = []
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        console.delaybeforesend = 0.01
        for line in source.decode('ascii').splitlines():
            shared['send_line'](console, line)
        for name, clock_word, answers in RUNS:
            output = capture_run(console, shared, clock_word, answers)
            assert 'CHICKEN !!!' in output, repr(output)
            assert 'BANG!!!!' in output, repr(output)
            if clock_word == 46:
                assert 'YOU WIN !!!' in output, repr(output)
                assert output.count('- CLICK -') == 10, repr(output)
            runs.append({'name': name, 'clockWord': clock_word, 'answers': answers, 'output': output})
            console.sendcontrol('c')
            console.expect_exact('READY')
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'pinnedSha256': shared['digest'](pinned),
        'fixtureSha256': shared['digest'](source),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
