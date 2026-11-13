"""Capture the GUESS source diagnostic and adapted replays from stock EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


CAPTURE = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
FIXTURES = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
SOURCES = {
    'guess.bas': 'd7f8c25bdd3ad6885ba33159b16701ff2f18371db2ad04e2478a4c73d4c78ce8',
    'guess-mar75-text.bas': 'a0a07de4a7d6b94ab8289d2785263e59294f87f4a15f9a5e0c3b1d76f9641e26',
    'guess-edusystem30.bas': 'b9307abe9b1229d4df364fb64a2fae7605547e9326f0e04bb50f7e297a1e201a',
}
RUNS = [
    ('both clues, fast and exact wins, limit reset', [
        '100', '50', '12', '23',
        '1', '2', '3', '4', '5', '6', '27',
        '0', '32', '26',
    ]),
    ('fresh run, too many guesses', [
        '8', '8', '8', '8', '8', '2',
    ]),
]
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'


def load(console, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        CAPTURE['send_line'](console, line)


def start(console):
    CAPTURE['send_line'](console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')


def replay(console, answers):
    start(console)
    chunks = []
    for answer in [*answers, None]:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        if answer is not None:
            CAPTURE['send_line'](console, answer)
    output = CAPTURE['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '')
    console.sendcontrol('c')
    console.expect_exact('READY')
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    simulator = args.simulator.resolve()
    tape = args.tape.resolve()
    assert CAPTURE['digest'](tape.read_bytes()) == CAPTURE['TAPE_SHA256']
    for path, digest in SOURCES.items():
        assert CAPTURE['digest']((FIXTURES / path).read_bytes()) == digest
    with CAPTURE['edu30'](simulator, tape) as console:
        load(console, (FIXTURES / 'guess-mar75-text.bas').read_text())
        start(console)
        console.expect_exact('READY')
        diagnostic = CAPTURE['normalize'](console.before).strip().splitlines()
        assert diagnostic == [
            f'ST {label}' for label in
            (1, 2, 3, 4, 5, 6, 7, 10, 14, 20, 32, 40, 50, 56, 57, 58, 60, 71)
        ], diagnostic
    with CAPTURE['edu30'](simulator, tape) as console:
        load(console, (FIXTURES / 'guess-edusystem30.bas').read_text())
        runs = [replay(console, answers) for _, answers in RUNS]
    first, second = runs
    assert 'TOO HIGH.' in first and 'TOO LOW.' in first, repr(first)
    assert first.count('VERY GOOD!') == 2, repr(first)
    assert '\nGOOD!\n' in first, repr(first)
    assert first.count('WHAT LIMIT DO YOU WANT?') == 2, repr(first)
    assert 'YOU SHOULD HAVE BEEN ABLE TO GET IT IN ONLY 4 .' in second, repr(second)
    assert all(output.endswith('NOW YOU TRY TO GUESS WHAT IT IS\n?') for output in runs), runs
    args.output.write_text(json.dumps({
        'simulatorCommit': CAPTURE['SIMULATOR'],
        'tapeSha256': CAPTURE['TAPE_SHA256'],
        'rawFixtureSha256': SOURCES['guess.bas'],
        'printedFixtureSha256': SOURCES['guess-mar75-text.bas'],
        'fixtureSha256': SOURCES['guess-edusystem30.bas'],
        'printedDiagnostics': diagnostic,
        'runs': [
            {'name': name, 'answers': answers, 'outputSha256': CAPTURE['digest'](output.encode('ascii'))}
            for (name, answers), output in zip(RUNS, runs, strict=True)
        ],
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
