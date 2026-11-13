"""Verify the CUBE spacing adaptation on stock EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


RUNS = [
    ('win, wager retry, and illegal replay move',
     ['1', '1', '600', '50', '1,1,2', '2,1,2', '2,2,2', '2,2,3', '2,3,3',
      '3,3,3', '1', '1', '20', '1,2,2', '0']),
    ('fresh run and mine loss', ['0', '1', '50', '1,1,2', '1,2,2', '0']),
]
PROMPT = r'(?:(?<![A-Z)])|(?<=BET AGAIN))\?'


def normalize_source(source):
    lines = []
    for line in source.splitlines():
        if not line.strip():
            continue
        label, body = line.split(maxsplit=1)
        parts = body.split('"')
        for index in range(0, len(parts), 2):
            text = re.sub(r'^(LET|IF|PRINT)(?=[A-Z0-9])', r'\1 ', parts[index])
            text = re.sub(r'\s*THEN\s*', ' THEN ', text)
            parts[index] = re.sub(r'\bGO\s*TO\s*', 'GOTO ', text)
        lines.append(label + ' ' + '"'.join(parts))
    return '\n'.join(lines) + '\n'


def capture(simulator, tape, shared, source, answers):
    with shared['edu30'](simulator, tape) as console:
        console.delaybeforesend = .008
        send = shared['send_line']
        for line in source.splitlines():
            if line:
                send(console, line)
        send(console, 'RUN')
        console.expect_exact('EDUSYSTEM-30\r\n\r\n')
        chunks = []
        for answer in answers:
            console.expect(PROMPT)
            chunks.append(console.before + '?')
            send(console, answer)
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
    raw = (fixtures / 'cube.bas').read_bytes()
    adapted = (fixtures / 'cube-edusystem30.bas').read_bytes()
    assert shared['digest'](raw) == 'd17aa56fbd9fbc27dd6ba3a8a46605d2674b196d461b15e7a72444ca5be42ae0'
    assert normalize_source(raw.decode('ascii')).encode('ascii') == adapted
    with ThreadPoolExecutor() as pool:
        raw_job = pool.submit(capture, simulator, tape, shared, raw.decode('ascii'), RUNS[1][1])
        jobs = [
            pool.submit(capture, simulator, tape, shared, adapted.decode('ascii'), answers)
            for _, answers in RUNS
        ]
        runs = [
            {'name': name, 'answers': answers, 'output': job.result()}
            for (name, answers), job in zip(RUNS, jobs)
        ]
    win, loss = (run['output'] for run in runs)
    assert raw_job.result() == loss
    assert all(text in win for text in (
        'TRIED TO FOOL ME; BET AGAIN?', 'CONGRATULATIONS', '550 DOLLARS',
        'ILLEGAL MOVE', '530 DOLLARS', 'GOODBYE',
    )), win
    assert all(text in loss for text in ('******BANG******', '450 DOLLARS', 'GOODBYE')), loss
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'fixtureSha256': shared['digest'](adapted),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
