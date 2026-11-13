"""Replay the 21 printed SLOTS spins in stock archived EDU30.SV."""

import argparse
import json
import re
import runpy
from pathlib import Path


RAW_SHA256 = '9a2972829e96bf7046386656e253bbdda8c29d95f922e25087ee6cdae238a1d7'
PRINTED_SHA256 = 'a9ae50c07e84fab8341ed2b3214f65a9117d8695a0f9190a64d12648a71f81a5'
SOURCE_SHA256 = 'd1a90662051650c9d2b5e5c3b177d7a9b5cd6a182e1599b2b1ee2b29df0bd69d'
CLOCK_WORD = 3289
BANNER = 'EDUSYSTEM-30\r\n\r\n'
PROMPT = 'AGAIN?'
TAPE_FLUSH_NOTICE = 'DT0: writing buffer to file: working.tu56\r\n'
SYMBOLS = ['BELL', 'BAR', 'CHERRY', 'APPLE', 'LEMON', '$']
# Reel positions and the running total in the sample on printed page 199.
PRINTED_SPINS = [
    (1, 4, 1, 1), (4, 4, 3, 6), (4, 4, 4, 26), (4, 2, 4, 27), (6, 6, 3, 32),
    (1, 5, 3, 31), (6, 3, 6, 32), (4, 6, 2, 31), (6, 3, 1, 30), (3, 1, 1, 29),
    (2, 5, 1, 28), (6, 3, 3, 27), (1, 1, 2, 28), (6, 5, 4, 27), (5, 3, 2, 26),
    (2, 4, 2, 27), (3, 5, 3, 28), (1, 6, 5, 27), (1, 5, 5, 26), (1, 5, 5, 25),
    (3, 3, 6, 26),
]
RUNS = [
    ('all 21 printed spins', ['Y'] * 20 + ['N'], PRINTED_SPINS),
    ('fresh RUN with invalid replay response', ['X', 'Y', 'N'], PRINTED_SPINS[:2]),
]


def load(console, shared, source):
    console.delaybeforesend = 0.01
    for line in source.decode('ascii').splitlines():
        shared['send_line'](console, line)


def capture_run(console, shared, answers):
    send_line = shared['send_line']

    def command(text):
        console.sendline(text)
        console.expect_exact('sim> ')

    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command('break 02755')
    console.sendline('continue')
    send_line(console, 'RUN')
    console.expect_exact(BANNER)
    console.expect_exact('Breakpoint, PC: 02755')
    assert console.before.replace(TAPE_FLUSH_NOTICE, '') == '\r\n', repr(console.before)
    console.expect_exact('sim> ')
    command(f'deposit 7471 {CLOCK_WORD:o}')
    command('nobreak 02755')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    chunks = []
    for index, answer in enumerate(answers):
        marker = '\r\n' if index and answers[index - 1] == 'X' else PROMPT
        console.expect_exact(marker)
        chunks.append(console.before + marker)
        console.send(answer)
        console.expect_exact(answer)
        assert console.before == '', repr(console.before)

    console.expect_exact('READY')
    tail = console.before
    assert tail.endswith('\x00\r\n'), repr(tail)
    chunks.append(tail[:-3])
    return ''.join(chunks).replace(
        TAPE_FLUSH_NOTICE, ''
    ).replace('\r\n', '\n')


def verify(output, spins):
    rows = re.findall(r'^( +.*TOTAL=\$ *-?\d+ .*AGAIN\?)$', output, re.M)
    assert len(rows) == len(spins), repr(output)
    for row, (first, second, third, total) in zip(rows, spins, strict=True):
        assert [row[start:start + 7].strip() for start in (7, 14, 21)] == [
            SYMBOLS[i - 1] for i in (first, second, third)
        ], row
        assert re.search(rf'TOTAL=\$ *{total} \x07?AGAIN\?$', row), row
    assert output.endswith("IT'S BEEN NICE OPERATING FOR YOU COME BACK SOON!\n"), repr(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    sim, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'

    def read(name, digest):
        content = (fixtures / name).read_bytes()
        assert shared['digest'](content) == digest
        return content

    raw = read('slots.bas', RAW_SHA256)
    printed = read('slots-mar75-text.bas', PRINTED_SHA256)
    source = read('slots-edusystem30.bas', SOURCE_SHA256)
    with shared['edu30'](sim, tape) as console:
        load(console, shared, raw)
        shared['send_line'](console, 'RUN')
        console.expect_exact(BANNER)
        console.expect_exact('READY')
        raw_diagnostics = shared['normalize'](console.before).strip().splitlines()
        assert raw_diagnostics == ['S1 560', 'S1 560'], raw_diagnostics
    assert source == printed.replace(b'220 IF D(G1)=2 THE N 300', b'220 IF D(G1)=2 THEN 300')
    with shared['edu30'](sim, tape) as console:
        load(console, shared, source)
        transcripts = [capture_run(console, shared, answers) for _, answers, _ in RUNS]
    for (_, _, spins), output in zip(RUNS, transcripts, strict=True):
        verify(output, spins)
    assert transcripts[0].count('\x07') == 2, repr(transcripts[0])

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA256,
        'rawDiagnostics': raw_diagnostics,
        'printedFixtureSha256': PRINTED_SHA256,
        'fixtureSha256': SOURCE_SHA256,
        'clockWord': CLOCK_WORD,
        'runs': [
            {
                'name': name,
                'answers': answers,
                'totals': [total for _, _, _, total in spins],
                'outputSha256': shared['digest'](output.encode('ascii')),
            }
            for (name, answers, spins), output in zip(RUNS, transcripts, strict=True)
        ],
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
