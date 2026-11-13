"""Capture the three printed WAR-2 games on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import runpy


RUNS = [
    ('treaty', '30000 20000 22000 1 2 1 2.34'.split(), 'RESPECTIVE COUNTRIES, AND LIVE IN PEACE.'),
    ('loss', '72000 300000 34 2333 54322 74633 3455 6344 27700 2 17899 3000 2 3344'.split(),
     'RIGHT FOR PLAYING THIS STUPID GAME!!!'),
    ('win', '2000 30000 6444 3 6443 3 5'.split(), 'YOU WON, OH! SHUCKS!!!!!'),
]


def capture(simulator, tape, shared, source, answers):
    with shared['edu30'](simulator, tape) as console:
        console.delaybeforesend = 0.01
        for line in source.splitlines():
            if line:
                shared['send_line'](console, line)
        shared['send_line'](console, 'RUN')
        console.expect_exact('EDUSYSTEM-30\r\n\r\n')
        chunks = []
        for answer in answers:
            # Line 1000 has a question mark in the printed move heading.
            console.expect(r'(?<!MOVE)\?')
            chunks.append(console.before + '?')
            shared['send_line'](console, answer)
        console.expect_exact('\0\r\nREADY')
        chunks.append(console.before)
        return ''.join(chunks).replace(
            'DT0: writing buffer to file: working.tu56\r\n', '',
        ).replace('\r\n', '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = directory.parent / 'package/fixtures/classic'
    raw, reviewed, adapted = [
        (fixtures / name).read_bytes() for name in
        ('war2.bas', 'war2-mar75-text.bas', 'war2-edusystem30-adapted.bas')
    ]
    assert shared['digest'](raw) == 'ebfdb104dfdf10e1f660ba029f3be6a69e36b31d4c58d2e5b0f65966503ebe74'

    def run(source, answers):
        return capture(simulator, tape, shared, source.decode('ascii'), answers)

    with ThreadPoolExecutor() as pool:
        raw_job = pool.submit(run, raw, [])
        reviewed_job = pool.submit(run, reviewed, [])
        sessions = [pool.submit(run, adapted, answers) for _, answers, _ in RUNS]
        raw_diagnostics = raw_job.result().splitlines()
        reviewed_diagnostics = reviewed_job.result().splitlines()
        assert 'ST 2' in raw_diagnostics
        assert {'ST 2', 'ST 13', 'ST 115', 'S1 23', 'S1 1050'} <= set(reviewed_diagnostics)
        runs = []
        for (name, answers, ending), session in zip(RUNS, sessions):
            output = session.result()
            assert output.startswith('I AM AT WAR WITH YOU.\n')
            assert output.endswith(ending + '\n'), repr(output)
            assert 'WHAT IS YOUR NEXT MOVE?\nARMY=1  NAVY=2  AIR FORCE=3\n?HOW MANY MEN\n?' in output
            if name == 'loss':
                assert output.count('DISTRIBUTE YOUR FORCES.\n') == 3
                assert '?HOW MANY MEN\n?HOW MANY MEN\n?' in output
            runs.append({'name': name, 'answers': answers, 'output': output})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawDiagnostics': raw_diagnostics,
        'reviewedDiagnostics': reviewed_diagnostics,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
