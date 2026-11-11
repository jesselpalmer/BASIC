"""Reproduce the reviewed EVEN listing on archived EDU30.SV in SIMH."""

import argparse
import json
import runpy
from pathlib import Path


SOURCE_SHA256 = 'a71644ae93419433525e5798422a156186ebbf5243a61e3a572683e1887c2eed'
TAPE_FLUSH_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
RUNS = [
    ('printed game and replay', ['1', '1', '2', '2', '1', '1', '3', '1', '1',
                                 '1', '2', '1', '2', '2', '1', '4', '0']),
    ('computer starts and invalid moves', ['0', '0', '5', '2', '2', '3', '1', '2', '1', '0']),
]


def capture_game(console, shared, answers):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        console.expect_exact('\r\n?')
        chunks.append(console.before + '\n?')
        send_line(console, answer)
    console.expect_exact('READY')
    tail = shared['normalize'](console.before).replace(TAPE_FLUSH_NOTICE, '')
    assert tail.endswith('\n\n'), repr(tail)
    chunks.append(tail[:-1])
    return shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH_NOTICE, '')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    root = Path(__file__).resolve().parents[2]
    fixture = (root / 'scripts/package/fixtures/classic/even-mar75-text.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            shared['send_line'](console, line)
        printed, fresh = [capture_game(console, shared, answers) for _, answers in RUNS]
    assert printed.count('I WON. DO YOU WANT TO PLAY') == 1, repr(printed)
    assert printed.count('YOU WON. DO YOU WANT TO PLAY') == 1, repr(printed)
    assert 'MY TOTAL IS 16   YOUR TOTAL IS 11 ' in printed, repr(printed)
    assert 'MY TOTAL IS 15   YOUR TOTAL IS 12 ' in printed, repr(printed)
    assert '?TOTAL = 27 \nI PICK UP 2  MARBLES.' in fresh, repr(fresh)
    assert fresh.count('INTEGER BETWEEN 1 AND 4.') == 2, repr(fresh)
    assert fresh.count('YOU HAVE TRIED TO TAKE MORE MARBLES') == 1, repr(fresh)
    assert 'YOUR TOTAL IS  7 \nI PICK UP 4  MARBLES.\nTOTAL = 6 ' in fresh, repr(fresh)
    for transcript in (printed, fresh):
        assert transcript.endswith('   OK.  SEE YOU LATER.\n'), repr(transcript)
    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'runs': [
            {'name': name, 'answers': answers, 'outputSha256': shared['digest'](transcript.encode('ascii'))}
            for (name, answers), transcript in zip(RUNS, (printed, fresh), strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
