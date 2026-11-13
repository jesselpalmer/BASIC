"""Replay the standalone BUZZWD adaptation and probe three-scalar INPUT."""

import argparse
import json
import runpy
from pathlib import Path


RAW_SHA256 = 'db72b73ff978a030486616fd961f70bae322935e05b14782b808951261ce42ce'
PRINTED_SHA256 = '8e56b1e61ba77f5f26e077c2f9c444e7e95e1b4d2f07eaa6bcd4273ef36a71b2'
SOURCE_SHA256 = 'd984a8fe87e106f45d85200172415c50d4f6d4ce7440ea6688a3affd30766a77'
RUNS = [
    ('printed phrases and farewell', [
        '1,2,3', '2,3,4', '0,0,0', '9,8,7', '7,8,9', '5,3,8',
        '2,6,4', '3,4,5', '100,100,100',
    ]),
    ('partial input, bad data, range retry and repaired branch', [
        '1,2', '3', '0,BAD,4', '0,2', '-1,0,0', '100,100,100',
    ]),
]
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\n'


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        shared['send_line'](console, line)


def run(console, shared, answers):
    send_line = shared['send_line']
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        # The introduction quotes a question mark before the first prompt.
        console.expect(r'(?<!\x27)\?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('\r\nREADY')
    chunks.append(console.before)
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

    def read(name, digest):
        data = (fixtures / name).read_bytes()
        assert shared['digest'](data) == digest
        return data.decode('ascii')

    read('buzzwd.bas', RAW_SHA256)
    printed = read('buzzwd-mar75-text.bas', PRINTED_SHA256)
    source = read('buzzwd-edusystem30.bas', SOURCE_SHA256)
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        load(console, shared, printed)
        shared['send_line'](console, 'RUN')
        console.expect_exact('EDUSYSTEM-30\r\n\r\n')
        console.expect_exact('READY')
        printed_diagnostic = shared['normalize'](console.before).strip()
        assert printed_diagnostic == 'UL 1080', repr(printed_diagnostic)
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        load(console, shared, source)
        outputs = [run(console, shared, answers) for _, answers in RUNS]
    printed_output, retry = outputs
    for phrase in [
        'TOTAL MONITORED MOBILITY', 'SYSTEMATIZED RECIPROCAL PROGRAMMING',
        'INTEGRATED MANAGEMENT OPTIONS', 'BALANCED THIRD-GENERATION PROJECTION',
        'SYNCHRONIZED THIRD-GENERATION CONTINGENCY', 'RESPONSIVE RECIPROCAL HARDWARE',
        'SYSTEMATIZED TRANSITIONAL PROGRAMMING', 'PARALLEL DIGITAL CONCEPT',
    ]:
        assert phrase in printed_output, repr(printed_output)
    assert 'BAD DATA-RETYPE FROM ERROR.' in retry and 'INTEGRATED MANAGEMENT CAPABILITY' in retry
    assert 'NUMBERS MUST BE BETWEEN 0 AND 9.' in retry
    for output in outputs:
        assert 'GOODBYE FOR NOW!' in output, repr(output)
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'printedFixtureSha256': PRINTED_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'printedDiagnostic': printed_diagnostic,
        'runs': [
            {'name': name, 'answers': answers, 'outputSha256': shared['digest'](output.encode('ascii'))}
            for (name, answers), output in zip(RUNS, outputs, strict=True)
        ],
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
