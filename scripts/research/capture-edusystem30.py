"""Capture bounded RNG and 23MTCH observations from the archived EDU30.SV.

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
ANSWERS = [3, 1, 2, 1, 1, 0, 1, 2, 3, 3, 2, 1, 1]
REPLAY_PROBE_ANSWER = 2


def digest(data):
    return hashlib.sha256(data).hexdigest()


def normalize(text):
    return text.replace('\r', '').replace('\0', '')


@contextmanager
def edu30(simulator, tape):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        # The OS/8 port writes scratch blocks while compiling a RUN.
        shutil.copyfile(tape, path / 'working.tu56')
        (path / 'boot.ini').write_text(
            'set cpu 32k\nset tti 7b\nset tto 7b\n'
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


def capture_game(console, source, joined_prompt):
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
    loss = transcript.index('I WON!!')
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert digest(tape.read_bytes()) == TAPE_SHA256
    fixture = (Path(__file__).resolve().parents[2] / FIXTURE).read_bytes()
    assert digest(fixture) == FIXTURE_SHA256
    source = fixture.decode('ascii')
    joined = source.replace(
        '220 PRINT "HOW MANY DO YOU TAKE"\n', '220 PRINT "HOW MANY DO YOU TAKE";\n'
    )
    assert len(joined) == len(source) + 1

    with edu30(simulator, tape) as console:
        rng = capture_random(console)
    with edu30(simulator, tape) as console:
        game = capture_game(console, source, joined_prompt=False)
    with edu30(simulator, tape) as console:
        joined_game = capture_game(console, joined, joined_prompt=True)
    choices = [int(3 * Decimal(value)) + 1 for value in rng['printedRnd0'][:6]]
    assert choices == game['computerMoves'][5:]
    assert joined_game['transcriptSha256'] != game['transcriptSha256']

    evidence = {
        'schemaVersion': 1,
        'simulatorCommit': SIMULATOR,
        'tapeSha256': TAPE_SHA256,
        'fixture': FIXTURE,
        'fixtureSha256': FIXTURE_SHA256,
        'rng': rng,
        'game': {
            'answers': ANSWERS,
            'thirdRoundProbeAnswer': REPLAY_PROBE_ANSWER,
            **game,
            'line220SemicolonTranscriptSha256': joined_game['transcriptSha256'],
        },
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
