"""Capture CHIEF's stock source diagnostics and complete MARK-adapted runs."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\n'
READY = 'OUT FOR?'
CORRECT = 'WAS I RIGHT?'
ORIGINAL = 'WHAT WAS YOUR ORIGINAL NUMBER?'
BELIEVE = 'NOW DO YOU BELIEVE ME?'
RUNS = [
    ('printed arithmetic and full lightning bolt',
     [(READY, 'N', True), ('\r\n?', '3.8', False), (CORRECT, 'N', True),
      (ORIGINAL, '12', False), (BELIEVE, 'N', True)]),
    ('fresh immediate agreement',
     [(READY, 'Y', True), ('\r\n?', '8.8', False), (CORRECT, 'Y', True)]),
    ('agreement after the explanation',
     [(READY, 'Y', True), ('\r\n?', '3.8', False), (CORRECT, 'N', True),
      (ORIGINAL, '12', False), (BELIEVE, 'Y', True)]),
]


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        shared['send_line'](console, line)


def begin(console, shared):
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)


def output_to_ready(console, shared):
    console.expect_exact('\r\nREADY')
    return shared['normalize'](console.before).replace(TAPE_FLUSH, '')


def capture_rejection(console, shared, source):
    load(console, shared, source)
    begin(console, shared)
    output = output_to_ready(console, shared)
    assert output == 'S1 40\nS1 130\nS1 290\n', repr(output)
    return output


def capture_run(console, shared, name, responses):
    begin(console, shared)
    chunks = []
    for prompt, answer, character in responses:
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        if character:
            console.send(answer)
            console.expect_exact(answer)
            assert console.before == '', repr(console.before)
        else:
            shared['send_line'](console, answer)
    chunks.append(output_to_ready(console, shared))
    output = shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH, '')
    return {
        'name': name,
        'answers': [answer for _, answer, _ in responses],
        'outputSha256': shared['digest'](output.encode('ascii')),
    }, output


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
    paths = ['chief.bas', 'chief-mar75-text.bas', 'chief-mark-adapted.bas']
    sources = [(fixtures / name).read_bytes() for name in paths]

    def reject(source):
        with shared['edu30'](args.simulator.resolve(), tape) as console:
            return capture_rejection(console, shared, source.decode('ascii'))

    with ThreadPoolExecutor() as pool:
        raw_diagnostic, printed_diagnostic = pool.map(reject, sources[:2])
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        load(console, shared, sources[2].decode('ascii'))
        runs, outputs = zip(*(capture_run(console, shared, *run) for run in RUNS), strict=True)

    bolt = [line for line in outputs[0].splitlines() if re.fullmatch(r' +[X*][ X*]*', line)]
    assert len(bolt) == 23, repr(outputs[0])
    assert bolt[:9] == [' ' * column + 'X X' for column in range(30, 21, -1)], bolt
    assert bolt[-1] == '          *', bolt
    assert '-3.625 ' in outputs[0] and 'WE GET 9.8 . MINUS 1 EQUALS 8.8 .' in outputs[0], outputs[0]
    assert all('BYE!!!!!' in output for output in outputs[1:]), outputs[1:]
    assert all('GREAT LIGHTNING BOLT!' not in output for output in outputs[1:]), outputs[1:]
    assert 'WHAT WAS YOUR ORIGINAL NUMBER' not in outputs[1], outputs[1]
    assert 'WHAT WAS YOUR ORIGINAL NUMBER' in outputs[2], outputs[2]
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](sources[0]),
        'printedFixtureSha256': shared['digest'](sources[1]),
        'fixtureSha256': shared['digest'](sources[2]),
        'rawDiagnostic': raw_diagnostic,
        'printedDiagnostic': printed_diagnostic,
        'boltRows': bolt,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
