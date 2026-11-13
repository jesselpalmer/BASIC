"""Recover TICTAC and replay it on the pinned OMSI tape."""

import argparse
import json
from pathlib import Path
import runpy


RUNS = (
    ('TICTAC', ['4,1', '1,1', '1,1', '1,2', '1,3', '2,1', '2', '1', '1,1', '1,2', '2,3', '3,1', '0']),
    ('DEMON', ['TIC-TAC-TOE', '3,1', '1,1', '2,3', '1,2', '0']),
)


def capture(console, archive, shared, entry, answers):
    def command(text, prompt='READY'):
        return archive['command'](console, shared, text, prompt)

    command('OLD', 'OLD FILE NAME')
    command(entry)
    command('NOLINE')
    menu = archive['MENU']
    chunks = []
    if entry == 'DEMON':
        chunks.append(command('RUN', menu) + shared['normalize'](menu))
    else:
        chunks.append(command('RUN', '?') + '?')
    for answer in answers[:-1]:
        chunks.append(command(answer, '?') + '?')
    chunks.append(command(answers[-1], menu) + shared['normalize'](menu))
    output = ''.join(chunks)
    banner = '\f\n\n' + entry.ljust(8) + 'EDUSYSTEM-30\n\n'
    assert output.startswith(banner), repr(output)
    assert 'TIE GAME' in output
    if entry == 'TICTAC':
        assert 'THE PDP-8 WINS THIS TIME' in output
        assert output.count('ILLEGAL MOVE -- TRY AGAIN') == 3
        assert 'I SAID ONE OR ZERO: TRY AGAIN' in output
        assert output.count('NEW GAME STARTED NOW') == 2
    else:
        # Page 220's four boards after the printed moves.
        expected_boards = [
            ('...', '.P.', 'Y..'),
            ('Y..', 'PP.', 'Y..'),
            ('Y..', 'PPY', 'Y.P'),
            ('YYP', 'PPY', 'Y.P'),
        ]
        boards = []
        for chunk in chunks:
            rows = []
            for line in chunk.splitlines():
                if len(line) >= 14 and line[4:6] == '* ' and line[10:12] == '* ':
                    cells = [line[:3], line[6:9], line[12:15]]
                    rows.append(''.join({'': '.', 'YOU': 'Y', 'PDP': 'P'}[cell.strip()]
                                        for cell in cells))
            if rows:
                boards.append(tuple(rows))
        assert boards == expected_boards, boards
    assert "IT'S BEEN FUN, COME AGAIN SOMETIME" in output
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
    raw = (fixtures / 'tictac.bas').read_bytes()
    assert digest(raw) == '0d6a0a6ab2edc7e7f02efd1ae9cd844d9b4fa1cc3080fefc0d4b22051fd8bed2'
    archived = (fixtures / 'tictac-edu30-tape.bas').read_bytes()
    adapted = (root / 'examples/omsi/TICTAC.bas').read_bytes()
    assert adapted == archived.replace(b'650LET', b'650 LET').replace(b'1050 GO TO900', b'1050 GO TO 900')

    with archive['console_on_copies'](simulator, tape, shared) as console:
        archive['command'](console, shared, 'OLD', 'OLD FILE NAME')
        archive['command'](console, shared, 'TICTAC')
        listing = archive['command'](console, shared, 'LIST', '\r\nREADY')
        assert listing.startswith('\f\n\nTICTAC  EDUSYSTEM-30\n\n'), repr(listing)
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
