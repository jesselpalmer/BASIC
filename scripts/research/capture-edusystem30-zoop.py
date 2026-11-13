"""Recover and replay ZOOP on the pinned EDUSYSTEM-30 tape."""

import argparse
import json
from pathlib import Path
import re
import runpy


READY = '\r\nREADY\r\n\r\n'
STEPS = [
    ('CA', "TALOG  TRY MONTGOMERY WARD'S"),
    ('SC', 'RATCH  GOT AN ITCH?'),
    ('SA', "VE I DON'T LIKE BANKS"),
    ('??\r', 'WHAT??'),
    ('TX', 'SAVE O.K., THE WHOLE DEC TAPE'),
    ('}', ' WIPED OUT COMPLETELY!!!'),
]


def compare_tokens(archived, adapted):
    def tokens(source):
        return [
            ''.join(part if index % 2 else re.sub(r'\s', '', part)
                    for index, part in enumerate(line.split('"')))
            for line in source.decode('ascii').splitlines()
        ]

    assert tokens(archived) == tokens(adapted)


def capture(console, archive, shared, entry):
    def command(text, prompt='READY'):
        return archive['command'](console, shared, text, prompt)

    command('OLD', 'OLD FILE NAME')
    command(entry)
    command('NOLINE')
    menu = archive['MENU']
    if entry == 'DEMON':
        menu_start = command('RUN', menu) + shared['normalize'](menu)
        start = command('ZOOP', READY) + shared['normalize'](READY)
    else:
        menu_start = ''
        start = command('RUN', READY) + shared['normalize'](READY)
    banner = '\f\n\n' + entry.ljust(8) + 'EDUSYSTEM-30\n\n'
    text = menu_start + start
    assert text.startswith(banner), repr(text)
    # send_line consumes the echoed Return after menu selection. Portable
    # acceptance accounts for that one line break.
    prefix = text.removeprefix(banner)

    steps = []
    for keys, expected in STEPS:
        console.send(keys)
        console.expect_exact(menu if keys == '}' else READY)
        assert console.before.startswith(keys), repr(console.before)
        body = shared['normalize'](console.before[len(keys):] + console.after)
        assert expected in body, repr(body)
        steps.append({'keys': list(keys.replace('\r', '\n')), 'output': body})
    return {'entry': entry, 'start': prefix, 'steps': steps}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    archive = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-omsi.py')))
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    digest = shared['digest']
    assert digest(tape.read_bytes()) == shared['TAPE_SHA256']
    root = Path(__file__).resolve().parents[2]
    fixtures = root / 'scripts/package/fixtures/classic'
    raw = (fixtures / 'zoop.bas').read_bytes()
    assert digest(raw) == '63840e940c2a780ad04ba4a731ec2f9b7456504919d2b06bbd6eba59218f1683'
    archived = (fixtures / 'zoop-edu30-tape.bas').read_bytes()
    adapted = (root / 'examples/omsi/ZOOP.bas').read_bytes()
    compare_tokens(archived, adapted)

    with archive['console_on_copies'](simulator, tape, shared) as console:
        archive['command'](console, shared, 'OLD', 'OLD FILE NAME')
        archive['command'](console, shared, 'ZOOP')
        listing = archive['command'](console, shared, 'LIST', '\r\nREADY')
        assert listing.startswith('\f\n\nZOOP    EDUSYSTEM-30\n\n'), repr(listing)
        source = listing.split('EDUSYSTEM-30\n\n', 1)[1].rstrip('\n') + '\n'
        assert source.encode('ascii') == archived, repr(source)

    sessions = []
    for entry in ('ZOOP', 'DEMON'):
        with archive['console_on_copies'](simulator, tape, shared) as console:
            sessions.append(capture(console, archive, shared, entry))

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': digest(raw),
        'tapeFixtureSha256': digest(archived),
        'adaptedFixtureSha256': digest(adapted),
        'sessions': sessions,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
