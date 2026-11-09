"""Capture bounded RNG and classic-game observations from the archived EDU30.SV.

Requires Python with pexpect and the pinned SIMH PDP-8 simulator and DECtape.
See docs/classic-source-review.md for provenance and reproduction.
"""

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path

import pexpect


SIMULATOR = '698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6'
TAPE_SHA256 = '281c9c5f125996d3496c7118e4601e20c7f29320e4abc7626d26de01502a081a'
FIXTURE = 'scripts/package/fixtures/classic/23mtch-corrected.bas'
FIXTURE_SHA256 = '6e20090bfdebc2f4760baa7568d53d6a64e18310f2f9daf6e95a883666956364'
REVIEWED_FIXTURE = 'scripts/package/fixtures/classic/23mtch-mar75-text.bas'
REVIEWED_SHA256 = '6b4ce01cdd00a638a415801bd912f9cbfe8ae02d1e42c6b41e759246f1f94ecc'
ANSWERS = [3, 1, 2, 1, 1, 0, 1, 2, 3, 3, 2, 1, 1]
REPLAY_PROBE_ANSWER = 2
STATE_SAMPLES = 512
RNG_ENTRY_PC = '03532'
RNG_PRODUCT_PC = '03541'
RNG_COMMIT_PC = '03554'
LETTER_FIXTURE = 'scripts/package/fixtures/classic/letter-mar75-text.bas'
LETTER_FIXTURE_SHA256 = 'c454938f15d835185d5512fbbc7dae548010da77f4ab6394ecec26672524dcb0'
LETTER_CLOCK_WORD = 0o2304
LETTER_ANSWERS = list('AZDAAAAAW')
TRAP_FIXTURE = 'scripts/package/fixtures/classic/trap-mar75-text.bas'
TRAP_FIXTURE_SHA256 = 'c814cd6a28870e3459a28b1a1e3e3b48722565adbf2afe5d86c26cfd34d092ba'
TRAP_ANSWERS = ['1', '23', 'BAD', '20', '30,40', '0,20', '23,23', *['0,0'] * 6, '37,37']
TRAP_INPUT_LINES = [
    '10 INPUT A', '20 INPUT B,C', '30 PRINT "A";A;"B";B;"C";C', '40 GOTO 10', '50 END',
]
TRAP_INPUT_ANSWERS = ['1,2,BAD', '3,4,5,6', '7,,8', '9', '', '1 . 5, - 2, + 3']
LITQZ_FIXTURE = 'scripts/package/fixtures/classic/litqz-mar75-text.bas'
LITQZ_SHA256 = 'ce16e0971e65cd37913d0a3be885c5fdd3769eb988fb24f377e56522baccc526'
LITQZ_ROUNDS = [
    (['3', '2', '4', '1'], 96, 'READING THE NURSERY GREATS. '),
    (['3', '2', '4', '3'], 130, 'LITERATURE (HA, HA, HA)'),
    (['1', '1', '1', '1'], 999, 'NURSERY SCHOOL FOR YOU, MY FRIEND. '),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def normalize(text):
    return text.replace('\r', '').replace('\0', '')


@contextmanager
def edu30(simulator, tape, *, space_parity=False):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        # The OS/8 port writes scratch blocks while compiling a RUN.
        shutil.copyfile(tape, path / 'working.tu56')
        (path / 'boot.ini').write_text(
            'set cpu 32k\nset tti 7b\nset tto 7b\n'
            + ('set tti space\n' if space_parity else '') +
            'attach dt0 working.tu56\nboot dt0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(simulator), ['boot.ini'], cwd=directory, encoding='ascii', timeout=12
        ) as console:
            console.expect_exact('\r\n.')
            assert SIMULATOR[:8] in console.before
            send_line(console, 'R EDU30')
            console.expect_exact('READY')
            yield console


def send_line(console, line):
    console.send(line + '\r')
    console.expect_exact(line)
    console.expect_exact('\r\n')


def capture_random(console):
    for line in ['10 FOR I=1 TO 12', '20 PRINT RND(0)', '30 NEXT I', '40 END']:
        send_line(console, line)

    def run():
        send_line(console, 'RUN')
        console.expect_exact('READY')
        return normalize(console.before)

    number_line = r' +([.0-9]+(?:E[+-][0-9]+)?) *$'

    def numbers(output):
        return re.findall('^' + number_line, output, re.M)

    sequence = numbers(run())
    assert len(sequence) == 12 and all(0 < Decimal(value) < 1 for value in sequence)
    assert numbers(run()) == sequence
    send_line(console, '20 PRINT RND(I-3)')
    assert numbers(run()) == sequence
    send_line(console, '20 PRINT RND(1/0)')
    fault = run()
    continued = re.findall(r'^ERROR D0 AT LINE 0020\n' + number_line, fault, re.M)
    assert continued == sequence and numbers(fault) == sequence
    return {
        'printedRnd0': sequence,
        'sameSequenceOnRun': True,
        'sameSequenceForArgumentsMinus2Through9': True,
        'divisionErrorsBeforeDraws': len(continued),
    }


def capture_random_state(console):
    for line in [f'10 FOR I=1 TO {STATE_SAMPLES}', '20 LET X=RND(0)', '30 NEXT I', '40 END']:
        send_line(console, line)

    def command(line):
        console.sendline(line)
        console.expect_exact('sim> ')
        return normalize(console.before)

    def breakpoint(address):
        console.expect_exact(f'Breakpoint, PC: {address}')
        console.expect_exact('sim> ')

    def word(address):
        output = command(f'examine {address}')
        match = re.search(rf'^{address}:\s+([0-7]{{4}})$', output, re.M)
        assert match, output
        return match[1]

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command(f'break {RNG_ENTRY_PC}')
    console.sendline('continue')
    send_line(console, 'RUN')
    breakpoint(RNG_ENTRY_PC)
    console.delaybeforesend = None
    seed = word('150') + word('151')
    multiplier = word('3563') + word('3564')
    command(f'nobreak {RNG_ENTRY_PC}')
    command(f'break {RNG_PRODUCT_PC},{RNG_COMMIT_PC}')

    products, states = [], []
    for index in range(STATE_SAMPLES):
        console.sendline('continue')
        if index < 12:
            breakpoint(RNG_PRODUCT_PC)
            products.append(word('27') + word('43'))
            if index == 11:
                command(f'nobreak {RNG_PRODUCT_PC}')
            console.sendline('continue')
        breakpoint(RNG_COMMIT_PC)
        states.append(word('150') + word('151'))

    console.sendline('continue')
    console.expect_exact('READY')
    return {
        'entryPcOctal': RNG_ENTRY_PC,
        'productPcOctal': RNG_PRODUCT_PC,
        'commitPcOctal': RNG_COMMIT_PC,
        'initialStateOctal': seed,
        'multiplierOctal': multiplier,
        'middleProductWordsOctal': products,
        'committedStatesOctal': states,
    }


def capture_game(console, source, joined_prompt, loss_message='I WON!! BETTER'):
    for line in source.splitlines():
        send_line(console, line)
    send_line(console, 'RUN')
    question = 'HOW MANY DO YOU TAKE' + ('' if joined_prompt else '\r\n') + '?'
    output = []
    for answer in [*ANSWERS, REPLAY_PROBE_ANSWER]:
        console.expect_exact(question)
        output.append(console.before + question)
        send_line(console, str(answer))
        output.append(f'{answer}\n')
    console.expect_exact(question)
    output.append(console.before + question)
    console.sendcontrol('c')
    console.expect_exact('READY')

    transcript = normalize(''.join(output))
    counts = [int(value) for value in re.findall(r'THERE ARE NOW (\d+) MATCHES', transcript)]
    moves = [int(value) for value in re.findall(r'I TOOK (\d+)', transcript)]
    retry = transcript.index('YOU CHEATED!')
    loss = transcript.index(loss_message)
    win = transcript.index('SO YOU WON.')
    assert retry < loss < win and transcript.count('YOU CHEATED!') == 1
    assert counts == [23, 17, 13, 9, 5, 1, 23, 20, 16, 11, 6, 2, 23, 19]
    assert moves == [3, 3, 2, 3, 3, 1, 1, 2, 3, 3, 2]
    return {
        'remainingAtBoardPrints': counts,
        'computerMoves': moves,
        'results': ['computer-won', 'human-won'],
        'invalidMoveRetried': 0,
        'stoppedDuringThirdRound': True,
        'transcriptSha256': digest(transcript.encode('ascii')),
    }


def capture_letter(console, source):
    for line in source.splitlines():
        send_line(console, line)

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')
        return normalize(console.before)

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755,02757')
    console.sendline('continue')
    send_line(console, 'RUN')
    console.expect_exact('Breakpoint, PC: 02755')
    console.expect_exact('sim> ')
    seed = command('examine 150-151')
    assert re.search(r'150:\s+1461\n151:\s+3007', seed), seed
    command(f'deposit 7471 {LETTER_CLOCK_WORD:o}')
    console.sendline('continue')
    console.expect_exact('Breakpoint, PC: 02757')
    console.expect_exact('sim> ')
    added = command('examine ac')
    assert re.search(r'AC:\s+3765', added), added
    console.sendline('continue')
    console.expect_exact('\r\n')  # Simulator command echo.

    prompt = 'WHAT IS YOUR GUESS?'
    chunks = []
    for answer in LETTER_ANSWERS:
        console.expect_exact(prompt)
        chunks.append(console.before + prompt)
        console.send(answer)
        console.expect_exact(answer)
        assert console.before == '', console.before
    console.expect_exact(prompt)
    chunks.append(console.before + prompt)
    transcript = normalize(''.join(chunks))
    assert transcript.startswith('LETTER GUESSING GAME\n'), repr(transcript[:90])
    assert re.findall(r'YOU GOT IT IN (\d+) GUESSES!!', transcript) == ['3', '6']
    assert transcript.count('LET\'S PLAY AGAIN.....') == 2
    assert '\x07' * 15 in transcript and transcript.count('\x07') == 15
    return {
        'simulatorCommit': SIMULATOR,
        'tapeSha256': TAPE_SHA256,
        'fixtureSha256': digest(source.encode('ascii')),
        'clockWord': LETTER_CLOCK_WORD,
        'answers': LETTER_ANSWERS,
        'outputSha256': digest(transcript.encode('ascii')),
    }


def capture_letter_sequences(console):
    for line in [
        '10 FOR I=3 TO 1\\PRINT "IN";I\\NEXT I',
        '20 PRINT "AFTER REVERSE LOOP"',
        '30 IF 1=2 THEN 70\\PRINT "AFTER FALSE IF"',
        '40 PRINT "NEXT LINE"',
        '50 FOR I=0 TO 0\\PRINT "ZERO";I\\NEXT I',
        '70 END',
    ]:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('READY')
    lines = normalize(console.before).splitlines()
    result = lines[lines.index('AFTER REVERSE LOOP'):-1]
    assert result == ['AFTER REVERSE LOOP', 'AFTER FALSE IF', 'NEXT LINE', 'ZERO 0 ']
    return result


def capture_numeric_input_run(console, lines, answers):
    for line in lines:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    chunks = []
    for answer in answers:
        console.expect_exact('?')
        chunks.append(console.before + '?')
        send_line(console, answer)
    console.expect_exact('?')
    chunks.append(console.before + '?')
    transcript = normalize(''.join(chunks))
    console.sendcontrol('c')
    console.expect_exact('READY')
    return transcript


def capture_trap(console, source):
    transcript = capture_numeric_input_run(console, source.splitlines(), TRAP_ANSWERS)
    assert transcript.startswith('WANT INSTRUCTIONS (1 FOR YES)?')
    assert 'GUESS # 1 ??BAD DATA-RETYPE FROM ERROR.\n?YOU HAVE TRAPPED MY NUMBER.' in transcript
    assert 'MY NUMBER IS SMALLER THAN YOUR TRAP NUMBERS.' in transcript
    assert 'MY NUMBER IS LARGER THAN YOUR TRAP NUMBERS.' in transcript
    assert re.findall(r'GUESS # (\d+) ', transcript) == list('123412345611')
    assert transcript.count('YOU GOT IT!!!') == 2
    assert transcript.count('SORRY, THAT\'S 6 GUESSES. NUMBER WAS 27 ') == 1
    assert transcript.count('TRY AGAIN.') == 3
    return {
        'simulatorCommit': SIMULATOR,
        'tapeSha256': TAPE_SHA256,
        'fixtureSha256': digest(source.encode('ascii')),
        'answers': TRAP_ANSWERS,
        'outputSha256': digest(transcript.encode('ascii')),
    }


def capture_litqz(console, source):
    for line in source.splitlines():
        send_line(console, line)
    rounds = []
    prompts = ['4)GUIPETTO?', "4)STROMBOLI'S?", '4)TOTO?', '4)WENDY?']
    for answers, last_label, ending in LITQZ_ROUNDS:
        send_line(console, 'RUN')
        console.expect_exact('EDUSYSTEM-30\r\n\r\n')
        chunks = []
        for prompt, answer in zip(prompts, answers):
            console.expect_exact(prompt)
            chunks.append(console.before + prompt)
            send_line(console, answer)
        console.expect_exact('READY')
        tail = normalize(console.before)
        assert tail.endswith(ending + '\n\n'), repr(tail)
        # The shell emits one final newline before READY for both STOP and END.
        transcript = normalize(''.join(chunks)) + tail[:-1]
        rounds.append({
            'answers': answers,
            'lastLabel': last_label,
            'outputSha256': digest(transcript.encode('ascii')),
        })
    return rounds


def capture_stop(console):
    for line in ['20 PRINT "ALSO WRONG"', '30 END']:
        send_line(console, line)
    outputs = {}
    for command in ['STOP', 'END']:
        send_line(console, f'10 PRINT "BEFORE";\\{command}\\PRINT "WRONG"')
        send_line(console, 'RUN')
        console.expect_exact('EDUSYSTEM-30\r\n\r\n')
        console.expect_exact('READY')
        outputs[command] = normalize(console.before)
        assert outputs[command] == 'BEFORE\n', repr(outputs[command])
    send_line(console, 'CONT')
    console.expect_exact('WHAT?')
    return {'beforeReady': outputs, 'continueResponse': console.after}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    game = parser.add_mutually_exclusive_group()
    game.add_argument('--letter', action='store_true', help='Capture the LETTER replay')
    game.add_argument('--trap', action='store_true', help='Capture the TRAP replay and numeric INPUT')
    game.add_argument('--litqz', action='store_true', help='Capture the LITQZ endings and STOP behavior')
    args = parser.parse_args()
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert digest(tape.read_bytes()) == TAPE_SHA256
    root = Path(__file__).resolve().parents[2]
    if args.letter:
        letter = (root / LETTER_FIXTURE).read_bytes()
        assert digest(letter) == LETTER_FIXTURE_SHA256
        with edu30(simulator, tape, space_parity=True) as console:
            evidence = capture_letter(console, letter.decode('ascii'))
        with edu30(simulator, tape, space_parity=True) as console:
            evidence['sequenceProbeOutput'] = capture_letter_sequences(console)
        args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')
        return
    if args.trap:
        trap = (root / TRAP_FIXTURE).read_bytes()
        assert digest(trap) == TRAP_FIXTURE_SHA256
        with edu30(simulator, tape) as console:
            evidence = capture_trap(console, trap.decode('ascii'))
        with edu30(simulator, tape) as console:
            output = capture_numeric_input_run(console, TRAP_INPUT_LINES, TRAP_INPUT_ANSWERS)
        evidence['inputProbe'] = {
            'source': '\n'.join(TRAP_INPUT_LINES),
            'answers': TRAP_INPUT_ANSWERS,
            'output': output,
        }
        args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')
        return
    if args.litqz:
        source = (root / LITQZ_FIXTURE).read_bytes()
        assert digest(source) == LITQZ_SHA256
        with edu30(simulator, tape) as console:
            rounds = capture_litqz(console, source.decode('ascii'))
        with edu30(simulator, tape) as console:
            stop = capture_stop(console)
        evidence = {
            'simulatorCommit': SIMULATOR,
            'tapeSha256': TAPE_SHA256,
            'fixtureSha256': LITQZ_SHA256,
            'rounds': rounds,
            'stopProbe': stop,
        }
        args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')
        return
    fixture = (root / FIXTURE).read_bytes()
    assert digest(fixture) == FIXTURE_SHA256
    reviewed = (root / REVIEWED_FIXTURE).read_bytes()
    assert digest(reviewed) == REVIEWED_SHA256
    source = fixture.decode('ascii')
    joined = source.replace(
        '220 PRINT "HOW MANY DO YOU TAKE"\n', '220 PRINT "HOW MANY DO YOU TAKE";\n'
    )
    assert len(joined) == len(source) + 1

    with edu30(simulator, tape) as console:
        rng = capture_random(console)
    with edu30(simulator, tape) as console:
        rng_state = capture_random_state(console)
    with edu30(simulator, tape) as console:
        game = capture_game(console, source, joined_prompt=False)
    with edu30(simulator, tape) as console:
        joined_game = capture_game(console, joined, joined_prompt=True)
    with edu30(simulator, tape) as console:
        reviewed_game = capture_game(
            console, reviewed.decode('ascii'), joined_prompt=True, loss_message='I WON!!! BETTER'
        )
    choices = [int(3 * Decimal(value)) + 1 for value in rng['printedRnd0'][:6]]
    assert choices == game['computerMoves'][5:]
    assert joined_game['transcriptSha256'] != game['transcriptSha256']
    assert reviewed_game['transcriptSha256'] != joined_game['transcriptSha256']

    evidence = {
        'schemaVersion': 1,
        'simulatorCommit': SIMULATOR,
        'tapeSha256': TAPE_SHA256,
        'fixture': FIXTURE,
        'fixtureSha256': FIXTURE_SHA256,
        'reviewedFixture': REVIEWED_FIXTURE,
        'reviewedFixtureSha256': REVIEWED_SHA256,
        'rng': rng,
        'rngState': rng_state,
        'game': {
            'answers': ANSWERS,
            'thirdRoundProbeAnswer': REPLAY_PROBE_ANSWER,
            **game,
            'line220SemicolonTranscriptSha256': joined_game['transcriptSha256'],
            'reviewedTranscriptSha256': reviewed_game['transcriptSha256'],
        },
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
