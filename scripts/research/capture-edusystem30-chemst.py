"""Reproduce the reviewed CHEMST listing on archived EDU30.SV in SIMH."""

import argparse
import json
import re
import runpy
from pathlib import Path


SOURCE_SHA256 = '94f3d0dc79464473276d21de6e338488c7e84b6feac17364dd71ce93637634c5'
ANSWERS = ['BAD', '24.4', '31.9', '42', *['1000'] * 8]
PROMPT = 'LITERS OF KRYPTOCYANIC ACID. HOW MUCH WATER?'


def capture_game(console, shared):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in ANSWERS:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('READY')
    tail = shared['normalize'](console.before)
    assert tail.endswith('\n\n'), repr(tail)
    # The terminal appends a blank line before returning to READY.
    chunks.append(tail[:-1])
    output = shared['normalize'](
        ''.join(chunks).replace('DT0: writing buffer to file: working.tu56\r\n', '')
    )
    amounts = re.findall(r' (\d+) ' + re.escape(PROMPT), output)
    assert amounts[:3] == ['11', '13', '18'] and len(amounts) == 11, amounts
    assert PROMPT + 'BAD DATA-RETYPE FROM ERROR.\n?GOOD JOB!' in output, repr(output)
    assert ' 13 ' + PROMPT + 'SIZZLE!' in output, repr(output)
    assert ' 18 ' + PROMPT + 'GOOD JOB!' in output, repr(output)
    assert output.count('GOOD JOB!') == 2, repr(output)
    assert output.count('SIZZLE!') == 9, repr(output)
    assert output.count('ANOTHER LIFE.') == 8, repr(output)
    assert output.endswith('YOUR CONTRIBUTIONS TO THE FIELD OF COMIC BOOK CHEMISTRY.\n')
    return output


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
    fixture = (root / 'scripts/package/fixtures/classic/chemst.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in fixture.decode('ascii').splitlines():
            shared['send_line'](console, line)
        transcript = capture_game(console, shared)
        assert capture_game(console, shared) == transcript

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'fixtureSha256': SOURCE_SHA256,
        'game': {
            'answers': ANSWERS,
            'outputSha256': shared['digest'](transcript.encode('ascii')),
        },
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
