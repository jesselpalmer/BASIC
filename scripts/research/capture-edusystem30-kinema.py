"""Verify the KINEMA listing boundary and replay the explicit EDU30 adaptation."""

import argparse
import json
import runpy
from pathlib import Path


FILES = {
    'raw': ('kinema.bas', '2e132c859ae75104ca48afcc371a831bb726e86b4b3677e6d0e042c1da3ea81b'),
    'reviewed': ('kinema-mar75-text.bas', '4ae5792b35fbc8e85fb26a3d6b98cf88c7871fc6a09605fe54c2a63197e0194e'),
    'adapted': ('kinema-edu30-adapted.bas', '619ac5c0a8efb7709599bd136053f439227a9f64d9dd0d94e9b6245f51d9cd08'),
}
BANNER = 'EDUSYSTEM-30\r\n\r\n'
RUNS = [
    ['7.35', '2.5', '0', '14.74', '3.47', '-9.46'],
    ['0', '0', '0'],
]
PROBES = [
    (['10 PRI"YES"', '20 END'], 'ST 10'),
    (['10 PRINT "YES', '20 END'], 'UQ 10'),
    (['10 GOSUB50\\GO TO70', '50 PRINT "SUB"\\RETURN', '70 GOTO90', '90 END'], 'SUB'),
]


def run_source(shared, simulator, tape, source, answers=None):
    with shared['edu30'](simulator, tape) as console:
        send_line = shared['send_line']
        for line in source:
            send_line(console, line)
        send_line(console, 'RUN')
        console.expect_exact(BANNER)
        if answers is None:
            console.expect_exact('READY')
            return shared['normalize'](console.before)
        chunks = []
        for answer in answers:
            console.expect_exact('?')
            chunks.append(console.before + '?')
            send_line(console, answer)
        console.expect_exact('?')
        chunks.append(console.before + '?')
        console.sendcontrol('c')
        console.expect_exact('READY')
    return shared['normalize'](''.join(chunks))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    simulator = args.simulator.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    sources = {}
    for name, (file, digest) in FILES.items():
        payload = (fixtures / file).read_bytes()
        assert shared['digest'](payload) == digest
        sources[name] = payload.decode('ascii').splitlines()
    assert run_source(shared, simulator, tape, sources['reviewed']).strip() == 'ST 508'
    for source, expected in PROBES:
        assert run_source(shared, simulator, tape, source).strip() == expected
    transcripts = [run_source(shared, simulator, tape, sources['adapted'], answers) for answers in RUNS]
    assert all(output.startswith('\n\nA BALL IS THROWN UPWARDS AT 12 ') for output in transcripts)
    assert ' 2 RIGHT OUT OF 3. ' in transcripts[0] and ' 3 RIGHT OUT OF 3. ' in transcripts[0]
    for outcome in ['CORRECT! VERY GOOD!', 'CLOSE ENOUGH.', 'NOT EVEN CLOSE....']:
        assert outcome in transcripts[0]
    assert ' 0 RIGHT OUT OF 3. ' in transcripts[1] and 'NOT BAD.' not in transcripts[1]
    assert all(output.endswith('HOW HIGH WILL IT GO (IN METERS)?') for output in transcripts)
    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': FILES['raw'][1],
        'reviewedFixtureSha256': FILES['reviewed'][1],
        'fixtureSha256': FILES['adapted'][1],
        'runs': [
            {'answers': answers, 'outputSha256': shared['digest'](output.encode('ascii'))}
            for answers, output in zip(RUNS, transcripts, strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
