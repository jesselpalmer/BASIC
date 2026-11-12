"""Capture reviewed BLKJAK and character output from archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = '7f1a2e9c60e540534ab1aebacb8784e380a8b83a8e542649981d685278eecbac'
SOURCE_SHA256 = '11528649c4ec186854d46879a210f85fbef8960cfd9dd0a4fee40eb271d7d607'
CLOCK_WORD = 0
BANNER = 'EDUSYSTEM-30\r\n\r\n'
TAPE_FLUSH_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
BANKROLL = 'HOW MANY DOLLARS ARE YOU STARTING WITH?'
WAGER = 'WHAT IS YOUR WAGER THIS TIME?'
HIT = 'DO YOU WANT A HIT?'
REPLAY = 'DO YOU WISH TO PLAY AGAIN?'
RUNS = [
    ('invalid wagers, win, replay and bust', [
        (BANKROLL, '200'), (WAGER, '500'), (WAGER, '5'), (WAGER, '20'),
        (HIT, 'N'), (REPLAY, 'Y'), (WAGER, '30'), (HIT, 'Y'), (REPLAY, 'N'),
    ]),
    ('fresh run and winning finish', [
        (BANKROLL, '200'), (WAGER, '20'), (HIT, 'N'), (REPLAY, 'N'),
    ]),
]
CHR_SOURCE = [
    '10 A=65\\PRINT "0";CHR$(A);"X"',
    '20 PRINT "1";CHR$(65.5);"X"',
    '30 PRINT "2";CHR$(65.9);"X"',
    '40 PRINT "3";CHR$(66.1);"X"',
    '50 PRINT "4";CHR$(193);"X"',
    '60 PRINT "5";CHR$(321);"X"',
    '70 PRINT "6";CHR$(-63);"X"',
    '80 PRINT "7";CHR$(7);"X"',
    '90 END',
]


def capture_run(console, shared, responses):
    send_line = shared['send_line']

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')
        return shared['normalize'](console.before)

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755')
    console.sendline('continue')
    send_line(console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('Breakpoint, PC: 02755')
    prefix = console.before
    assert prefix.endswith('\r\n'), repr(prefix)
    # SIMH prints its breakpoint on a new line in the middle of the game.
    chunks = [prefix[:-2]]
    console.expect_exact('sim> ')
    assert re.search(r'150:\s+1461\n151:\s+3007', command('examine 150-151'))
    command(f'deposit 7471 {CLOCK_WORD:o}')
    command('nobreak 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    for prompt, answer in responses:
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        if prompt in (BANKROLL, WAGER):
            send_line(console, answer)
        else:
            console.send(answer)
            console.expect_exact(answer)
            assert console.before == '', repr(console.before)

    console.expect_exact('READY')
    tail = shared['normalize'](console.before)
    assert tail.endswith('\n\n'), repr(tail)
    chunks.append(tail[:-1])
    return shared['normalize'](''.join(chunks)).replace(TAPE_FLUSH_NOTICE, '')


def capture_raw_rejection(console, shared, source):
    for line in [*source.splitlines(), 'RUN']:
        shared['send_line'](console, line)
    console.expect_exact(BANNER)
    console.expect_exact('READY')
    output = shared['normalize'](console.before)
    assert output == 'UL 730\n\n', repr(output)
    return output.strip()


def capture_chr(console, shared):
    for line in [*CHR_SOURCE, 'RUN']:
        shared['send_line'](console, line)
    console.expect_exact(BANNER)
    console.expect_exact('READY')
    output = shared['normalize'](console.before)
    assert output == '0AX\n1AX\n2AX\n3BX\n4AX\n5AX\n6AX\n7\x07X\n\n', repr(output)
    return {'source': CHR_SOURCE, 'output': output[:-1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'
    raw = (fixtures / 'blkjak.bas').read_bytes()
    assert shared['digest'](raw) == RAW_SHA256
    fixture = (fixtures / 'blkjak-mar75-text.bas').read_bytes()
    assert shared['digest'](fixture) == SOURCE_SHA256
    with shared['edu30'](simulator, tape) as console:
        for line in fixture.decode('ascii').splitlines():
            shared['send_line'](console, line)
        transcripts = [capture_run(console, shared, responses) for _, responses in RUNS]
    loss, win = transcripts
    for output in transcripts:
        assert 'DEALING OFF THE BOTTOM OF THE DECK. \n\n' in output, repr(output)
        assert 'YOUR FIRST CARD IS 3\nYOUR SECOND CARD IS 4\nDEALER SHOWS A J\n' in output
        assert 'DEALER BUSTED. \nYOU WIN. YOU NOW HAVE $ 220 \n' in output
        assert output.endswith('HOPE YOU ENJOYED YOURSELF.  THANKS FOR PLAYING. \n')
    assert 'YOUR BET EXCEEDS YOUR REMAINING DOLLARS. \n' in loss
    assert 'MINIMUM WAGER IS $10. \n' in loss
    assert 'YOU GOT A 5\nYOU LOSE. YOU NOW HAVE $ 190 \n' in loss
    assert 'TOO BAD! YOU LOST 10 DOLLARS AT THE EDUSYSTEM CASINO. \n' in loss
    assert 'NOT BAD!  YOU WON 20 DOLLARS AT THE EDUSYSTEM CASINO. \n' in win
    with shared['edu30'](simulator, tape) as console:
        raw_diagnostic = capture_raw_rejection(console, shared, raw.decode('ascii'))
    with shared['edu30'](simulator, tape) as console:
        character_probe = capture_chr(console, shared)
    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'rawDiagnostic': raw_diagnostic,
        'fixtureSha256': SOURCE_SHA256,
        'clockWord': CLOCK_WORD,
        'runs': [
            {
                'name': name,
                'answers': [answer for _, answer in responses],
                'outputSha256': shared['digest'](output.encode('ascii')),
            }
            for (name, responses), output in zip(RUNS, transcripts, strict=True)
        ],
        'characterProbe': character_probe,
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
