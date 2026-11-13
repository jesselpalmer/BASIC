"""Capture ROCKT1 compiler diagnostics and two complete runs on EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import runpy


BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH = 'DT0: writing buffer to file: working.tu56\r\n'
INTRO = 'DO YOU WANT INSTRUCTIONS (Y OR N)? '
MISSION = 'ANOTHER MISSION (Y OR N)? '
CRASH = ['3'] * 4 + ['7', '9', '9', '8', '25', '25', '25']
PERFECT = ['5'] * 9 + ['30', '30']
RUNS = [
    ('printed crash and perfect landing replay', ['Y', *CRASH, 'Y', *PERFECT, 'N']),
    ('fresh perfect landing with thrust capped', ['N', *PERFECT[:-1], '40', 'N']),
]


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        if line:
            shared['send_line'](console, line)


def begin(console, shared):
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)


def finish(console):
    console.expect_exact('READY')
    tail = console.before.replace(TAPE_FLUSH, '')
    assert tail.endswith('\r\n\0\r\n'), repr(tail)
    return tail.removesuffix('\0\r\n')


def capture_run(console, shared, paper_output, name, answers):
    begin(console, shared)
    chunks = []
    for index, answer in enumerate(answers):
        if answer in ('Y', 'N'):
            prompt = INTRO if index == 0 else MISSION
            console.expect_exact(prompt)
            chunks.append(console.before + prompt)
            console.send(answer)
            console.expect_exact(answer)
            assert not console.before, repr(console.before)
        else:
            # The directions also quote a literal question mark.
            console.expect(r"(?<!')\?")
            chunks.append(console.before + '?')
            shared['send_line'](console, answer)
    chunks.append(finish(console))
    output = ''.join(chunks).replace(TAPE_FLUSH, '').replace('\r\n', '\n')
    touchdowns = re.findall(r'^TOUCHDOWN AT +([.\d]+) SECONDS\.', output, re.M)
    velocities = re.findall(r'^LANDING VELOCITY = +([.\d]+) FT/SEC', output, re.M)
    fuel = re.findall(r'^ (\d+) UNITS OF FUEL REMAINING\.', output, re.M)
    return {
        'name': name,
        'answers': answers,
        'touchdowns': touchdowns,
        'velocities': velocities,
        'fuelRemaining': fuel,
        'outputSha256': shared['digest'](output.encode('ascii')),
        'paperOutputSha256': shared['digest'](paper_output(output).encode('ascii')),
    }, output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    paper_output = runpy.run_path(str(directory / 'capture-edusystem30-bounce.py'))['paper_output']
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    fixtures = directory.parent / 'package/fixtures/classic'
    raw = (fixtures / 'rockt1.bas').read_bytes()
    reviewed = (fixtures / 'rockt1-mar75-text.bas').read_bytes()
    adapted = (fixtures / 'rockt1-mark-adapted.bas').read_bytes()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    assert shared['digest'](raw) == '1b238c24de29206c8b1b086bc4fedbef63e3173e3c578315e2c425ae0d0f9f15'
    assert [
        line.split()[0] for line, variant in zip(reviewed.splitlines(), adapted.splitlines(), strict=True)
        if line != variant
    ] == [b'100', b'120', b'520', b'530', b'850', b'870']

    def reject(source):
        with shared['edu30'](simulator, tape) as console:
            load(console, shared, source.decode('ascii'))
            begin(console, shared)
            console.expect_exact('READY')
            return shared['normalize'](console.before).replace(TAPE_FLUSH, '').strip().splitlines()

    def play():
        with shared['edu30'](simulator, tape) as console:
            load(console, shared, adapted.decode('ascii'))
            return [capture_run(console, shared, paper_output, *run) for run in RUNS]

    with ThreadPoolExecutor(max_workers=3) as pool:
        raw_rejection = pool.submit(reject, raw)
        reviewed_rejection = pool.submit(reject, reviewed)
        games = pool.submit(play)
        runs, transcripts = zip(*games.result(), strict=True)

    crash_and_replay, fresh = transcripts
    assert [run['touchdowns'] for run in runs] == [['18.6475', '11'], ['11']]
    assert [run['velocities'] for run in runs] == [['23.2379', '0'], ['0']]
    assert [run['fuelRemaining'] for run in runs] == [['0', '15'], ['15']]
    assert '*** OUT OF FUEL ***' in crash_and_replay and 'YOU BLEW IT!!!!' in crash_and_replay
    assert 'HERE ARE THE RULES' in crash_and_replay and 'HERE ARE THE RULES' not in fresh
    assert all('A PERFECT LANDING!' in output and 'CONTROL OUT.' in output for output in transcripts)
    assert all('\r\0' in output for output in transcripts)
    assert reviewed_rejection.result() == ['PC 100', 'S1 120', 'S1 520', 'S1 530', 'S1 870']
    assert raw_rejection.result() == [*reviewed_rejection.result(), 'UQ 880']
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': shared['digest'](raw),
        'reviewedFixtureSha256': shared['digest'](reviewed),
        'fixtureSha256': shared['digest'](adapted),
        'rawDiagnostics': raw_rejection.result(),
        'reviewedDiagnostics': reviewed_rejection.result(),
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
