"""Recover HORSES and replay it on the pinned OMSI tape."""

import argparse
import json
from pathlib import Path
import runpy


HORSE = 'ON WHAT HORSE DO YOU WISH TO BET (1-8)?'
POSITION = "'WIN', 'SHOW', OR 'PLACE'?"
WAGER = 'HOW MANY DOLLARS DO YOU WISH TO WAGER?'
MORE = "ANYMORE BETS ('YES' OR 'NO')? "
PAYOUTS = {
    'HORSES': (
        'ASSAULT     17.58  7.47  4.31 \n'
        'CITATION             5.13  3.15 \n'
        'GALLANT FOX                   5.61 \n'
    ),
    'DEMON': (
        'ASSAULT     17.85  7.22  4.22 \n'
        'STYMIE               15.77  8.71 \n'
        'CITATION                      3.82 \n'
    ),
}


def capture(console, archive, shared, entry):
    def command(text, prompt='READY'):
        return archive['command'](console, shared, text, prompt)

    command('OLD', 'OLD FILE NAME')
    command(entry)
    command('NOLINE')
    menu = archive['MENU']
    if entry == 'HORSES':
        prompts = [HORSE, POSITION, WAGER, MORE]
        answers = ['2', 'WIN', '5', 'NO']
    else:
        prompts = [menu, HORSE, HORSE, POSITION, WAGER, WAGER, MORE, HORSE, POSITION, WAGER, MORE]
        answers = ['HORSES', '9', '4', 'WIN', '1', '5', 'YES', '2', 'PLACE', '2', 'NO']
    chunks = [command('RUN', prompts[0]) + shared['normalize'](prompts[0])]
    for answer, before, after in zip(answers, prompts, [*prompts[1:], menu], strict=True):
        console.send(answer + '\r')
        console.expect_exact(after)
        # Numeric INPUT echoes CRLF. Character INPUT echoes CR and the
        # listing prints its own newline after recognizing that Return.
        echo = answer + ('\r\n' if before in (HORSE, WAGER) else '\r')
        assert console.before.startswith(echo), repr(console.before)
        chunks.append(shared['normalize'](console.before[len(echo):] + after))
    output = ''.join(chunks)
    banner = '\f\n\n' + entry.ljust(8) + 'EDUSYSTEM-30\n\n'
    assert output.startswith(banner), repr(output)
    assert output.count('POS.  HORSE   LENGTHS BEHIND') == 8
    assert 'FINISH\nPOS.  HORSE   LENGTHS BEHIND\n\n 1 ASSAULT' in output
    assert PAYOUTS[entry] in output
    if entry == 'HORSES':
        assert 'NEXT TIME, PURCHASE A SHOW TICKET ON CITATION' in output
        assert 'YOUR TOTAL LOSSES AMOUNT TO $ 5 ' in output
    else:
        assert 'HORSE NUMBER IN ERROR (MUST BE 1,2,3,4,5,6,7,OR 8)' in output
        assert 'BET MUST BE $2 OR GREATER BUT LESS THAN $300' in output
        assert 'YOU COLLECT 44.62 ON ASSAULT' in output, repr(output)
        assert 'NEXT TIME, PURCHASE A SHOW TICKET ON CITATION' in output
        assert 'YOUR TOTAL WINNINGS AMOUNT TO $ 37.62 ' in output
    assert output.endswith(shared['normalize'](menu))
    return {
        'entry': entry,
        'inputs': [
            {'answer': answer, 'prompt': shared['normalize'](prompt),
             'numeric': prompt in (HORSE, WAGER)}
            for answer, prompt in zip(answers, prompts, strict=True)
        ],
        'output': output.removeprefix(banner),
    }


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
    raw = (fixtures / 'horses.bas').read_bytes()
    assert digest(raw) == 'cbc3fed02ad1c86fc00f8d6a2f7428ffd4fa748a789542bf775be4e5adf0035d'
    archived = (fixtures / 'horses-edu30-tape.bas').read_bytes()
    adapted = (root / 'examples/omsi/HORSES.bas').read_bytes()
    assert adapted == (archived.replace(b'120PRINT', b'120 PRINT')
                       .replace(b'GO SUB', b'GOSUB').replace(b'THEN2070', b'THEN 2070'))

    with archive['console_on_copies'](simulator, tape, shared) as console:
        archive['command'](console, shared, 'OLD', 'OLD FILE NAME')
        archive['command'](console, shared, 'HORSES')
        listing = archive['command'](console, shared, 'LIST', '\r\nREADY')
        assert listing.startswith('\f\n\nHORSES  EDUSYSTEM-30\n\n'), repr(listing)
        source = listing.split('EDUSYSTEM-30\n\n', 1)[1].rstrip('\n') + '\n'
        normalized = '\n'.join(line.rstrip(' ') for line in source.splitlines()) + '\n'
        assert normalized.encode('ascii') == archived, repr(normalized)

    sessions = []
    for entry in ('HORSES', 'DEMON'):
        with archive['console_on_copies'](simulator, tape, shared) as console:
            sessions.append(capture(console, archive, shared, entry))
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
