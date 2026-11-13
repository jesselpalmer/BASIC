"""Capture BASBAL and BASBL1 source and storage boundaries on archived EDU30.SV."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import runpy

import pexpect


BANNER = 'EDUSYSTEM-30\r\n\r\n'
NAME_PROMPT = '(YOUR NAME PLEASE) THE '
PLAY_PROMPT = 'YOUR PLAY? '
TEAM = 'RSTS/E ROCKETS'
PLAYS = ['ZZ', 'BUNT', 'SWING', 'HIT-AWAY']


def begin(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        shared['send_line'](console, line)
    shared['send_line'](console, 'NOLINE')
    console.expect_exact('READY')
    shared['send_line'](console, 'RUN')
    console.expect_exact(BANNER)


def reject(console, shared, source, expected):
    begin(console, shared, source)
    console.expect_exact('READY')
    output = shared['normalize'](console.before).strip()
    assert output == expected, repr(output)
    return output


def observe_storage(console, shared):
    result = console.expect_exact(['READY', pexpect.TIMEOUT], timeout=3)
    assert result == 1, repr(console.before)
    output = shared['normalize'](console.before)
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 07312')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('Breakpoint, PC: 07312 (IOT 773)')
    return output


def opening(console, shared, source):
    begin(console, shared, source)
    console.expect_exact(NAME_PROMPT)
    heading = shared['normalize'](console.before) + NAME_PROMPT
    console.send(TEAM + '\r')
    output = observe_storage(console, shared)
    assert output.startswith(TEAM + '\n'), repr(output)
    body = output.removeprefix(TEAM + '\n')
    assert 'A HIGHLY PARTISAN CROWD OF 40778 FANS' in body, repr(body)
    assert TEAM + ' ADVANCES TO THE PLATE.' in body, repr(body)
    assert 'ALONG UNTIL ASKED FOR YOUR PLAY.' in body, repr(body)
    assert PLAY_PROMPT not in body, repr(body)
    return {'answer': TEAM, 'output': heading + body, 'chainWaitIotOctal': '6773'}


def companion(console, shared, source):
    begin(console, shared, source)
    console.expect_exact(PLAY_PROMPT)
    output = [shared['normalize'](console.before) + PLAY_PROMPT]
    for play in PLAYS:
        console.send(play + '\r')
        console.expect_exact(PLAY_PROMPT)
        response = shared['normalize'](console.before)
        assert response.startswith(play + '\n'), repr(response)
        output.append(response.removeprefix(play + '\n') + PLAY_PROMPT)
    transcript = ''.join(output)
    for expected in ('?\n', 'THAT WAS OUT NUMBER 1', 'INSIDE - BALL 1', 'CALL  STRIKE 1'):
        assert expected in transcript, repr(transcript)
    return {'answers': PLAYS, 'output': transcript}


def characters(console, shared):
    begin(console, shared, '\n'.join([
        '10 DIM A(2)', '20 INPUT $A(1)', '30 INPUT $A(2)',
        '40 PRINT A(1);A(2);CHR$(A(1))', '50 END',
    ]))
    console.send('A\r')
    console.expect_exact('READY')
    output = shared['normalize'](console.before).strip()
    assert output == 'A 193  141 A', repr(output)
    return output


def chain(console, shared):
    begin(console, shared, '\n'.join([
        '10 PRINT"BEFORE"', '20 CHAIN"DEMON "', '30 PRINT"AFTER"', '40 END',
    ]))
    output = observe_storage(console, shared).strip()
    assert output == 'BEFORE', repr(output)
    return {'output': output, 'chainWaitIotOctal': '6773'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--corpus', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    fixtures = directory.parent / 'package/fixtures/classic'
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']

    def read(path, sha256):
        source = path.read_bytes()
        assert shared['digest'](source) == sha256, path
        return source.decode('ascii')

    raw_hashes = {
        'basbal': '0cf3efbea619a50b2ab913b0304cabc5e25a5e2c0d90250c343ab71b0293a8bc',
        'basbl1': '2c3ac95029628b46505d33f55925e630e542a43d5c27d9ac09b3662a2e6de7c4',
    }
    reviewed_hashes = {
        'basbal': '769f51ae6efe45079234f536217b1eb8bfa61d510cceee8bc29f5e2cd1c2f8b9',
        'basbl1': '1691a2ea228977df2c954cfcd7bde0710c547d73aebf2b222f52c8fabf2fde16',
    }
    raw = {name: read(args.corpus / f'{name}.bas', sha) for name, sha in raw_hashes.items()}
    reviewed = {name: read(fixtures / f'{name}-mar75-text.bas', sha) for name, sha in reviewed_hashes.items()}

    def capture(probe, *inputs):
        with shared['edu30'](simulator, tape) as console:
            return probe(console, shared, *inputs)

    with ThreadPoolExecutor() as pool:
        cases = {
            'rawBasbal': pool.submit(capture, reject, raw['basbal'], 'S2 140'),
            'rawBasbl1': pool.submit(capture, reject, raw['basbl1'], 'S1 410'),
            'reviewedBasbal': pool.submit(capture, opening, reviewed['basbal']),
            'reviewedBasbl1': pool.submit(capture, companion, reviewed['basbl1']),
            'characterInput': pool.submit(capture, characters),
            'minimalChain': pool.submit(capture, chain),
        }
        observations = {name: case.result() for name, case in cases.items()}

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': raw_hashes,
        'reviewedFixtureSha256': reviewed_hashes,
        **observations,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
