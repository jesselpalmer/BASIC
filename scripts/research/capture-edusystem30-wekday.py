"""Recover WEKDAY and replay it on the pinned OMSI tape."""

import argparse
import json
from pathlib import Path
import runpy


RUNS = (
    ('WEKDAY', ['6,12,1973', '5,17,1939'], ' 5 / 17 / 1939  WAS A WEDNESDAY'),
    ('DEMON', ['WEEKDAY', '11,13,1975', '5,5,1960'], ' 5 / 5 / 1960  WAS A THURSDAY'),
)


def capture(console, archive, shared, entry, answers, result):
    def command(text, prompt='READY'):
        return archive['command'](console, shared, text, prompt)

    command('OLD', 'OLD FILE NAME')
    command(entry)
    command('NOLINE')
    menu = archive['MENU']
    chunks = []
    if entry == 'DEMON':
        chunks.append(command('RUN', menu) + shared['normalize'](menu))
        chunks.append(command(answers[0], '?') + '?')
    else:
        chunks.append(command('RUN', '?') + '?')
    chunks.append(command(answers[-2], '?') + '?')
    chunks.append(command(answers[-1], menu) + shared['normalize'](menu))
    output = ''.join(chunks)
    banner = '\f\n\n' + entry.ljust(8) + 'EDUSYSTEM-30\n\n'
    assert output.startswith(banner), repr(output)
    assert result in output
    assert 'YOUR AGE IF BIRTHDATE' in output
    assert '*YOU MAY RETIRE IN' in output
    return {'entry': entry, 'answers': answers, 'output': output.removeprefix(banner)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    archive = runpy.run_path(str(directory / 'capture-edusystem30-omsi.py'))
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    digest = shared['digest']
    assert digest(tape.read_bytes()) == shared['TAPE_SHA256']
    root = directory.parents[1]
    fixtures = root / 'scripts/package/fixtures/classic'
    raw = (fixtures / 'wekday.bas').read_bytes()
    assert digest(raw) == '450f5c887db233b65807a778aa3bfe45bab446be9be29720910bc587ade36588'
    archived = (fixtures / 'wekday-edu30-tape.bas').read_bytes()
    adapted = (root / 'examples/omsi/WEKDAY.bas').read_bytes()
    assert archived.count(b'710IF') == 1 and adapted == archived.replace(b'710IF', b'710 IF')

    with archive['console_on_copies'](simulator, tape, shared) as console:
        archive['command'](console, shared, 'OLD', 'OLD FILE NAME')
        archive['command'](console, shared, 'WEKDAY')
        listing = archive['command'](console, shared, 'LIST', '\r\nREADY')
        assert listing.startswith('\f\n\nWEKDAY  EDUSYSTEM-30\n\n'), repr(listing)
        source = listing.split('EDUSYSTEM-30\n\n', 1)[1].rstrip('\n') + '\n'
        normalized = '\n'.join(line.rstrip(' ') for line in source.splitlines()) + '\n'
        assert normalized.encode('ascii') == archived, repr(normalized)

    sessions = []
    for run in RUNS:
        with archive['console_on_copies'](simulator, tape, shared) as console:
            sessions.append(capture(console, archive, shared, *run))
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': digest(raw),
        'tapeListBodySha256': digest(source.encode('ascii')),
        'tapeFixtureSha256': digest(archived),
        'adaptedFixtureSha256': digest(adapted),
        'sessions': sessions,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
