"""Capture EDUSYSTEM-30 compiled numeric literals and their scale tables."""

import argparse
import json
import re
import runpy
from pathlib import Path


ACCEPTED = [
    '0', '1', '10', '8388609', '34359738367', '.1', '.3', '.5', '.9',
    '.01', '.03', '.05', '.51', '.2777', '.001', '.005', '1.2', '1.8',
    '4.59', '1.234569', '1E-3', '5E-3', '1E-8', '1E-16', '1E-21',
    '1E+8', '1E+16', '1E+100', '1E-100', '.0000000000000000000003',
]
REJECTED = ['34359738368', '34.359738368', '34359738368E-1', '1.0000000000000001']
SCALARS = 'APC'


def capture_scale_tables(console, send_line):
    for line in ['10 P=1.8', '20 INPUT W', '30 END']:
        send_line(console, line)
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('break 03355')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')
    send_line(console, 'RUN')
    console.expect_exact('Breakpoint, PC: 03355')
    console.expect_exact('sim> ')
    console.sendline('examine 03137-03174,01335-01372')
    console.expect_exact('sim> ')
    words = {
        int(address, 8): word for address, word in
        re.findall(r'^([0-7]+):\s+([0-7]{4})\r?$', console.before, re.M)
    }

    def table(base):
        return [[words[base + index * 3 + offset] for offset in range(3)]
                for index in range(10)]

    return {'positiveScaleOctal': table(0o3137), 'negativeScaleOctal': table(0o1335)}


def capture_accepted(console, shared, read_scalar_words, samples):
    send_line = shared['send_line']
    groups = [samples[index:index + len(SCALARS)] for index in range(0, len(samples), len(SCALARS))]
    for index, literals in enumerate(groups, 1):
        assignments = '\\'.join(f'{name}={literal}' for name, literal in zip(SCALARS, literals))
        send_line(console, f'{index * 20} {assignments}')
        send_line(console, f'{index * 20 + 10} INPUT W')
    send_line(console, '999 END')
    send_line(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    observations = []
    for literals in groups:
        console.expect_exact('?')
        words = read_scalar_words(console)
        observations.extend({'source': literal, 'wordsOctal': words[name]}
                            for name, literal in zip(SCALARS, literals))
        send_line(console, '0')
    console.expect_exact('READY')
    return observations


def capture_rejected(console, shared):
    send_line = shared['send_line']
    send_line(console, '20 END')
    observations = []
    for raw in REJECTED:
        send_line(console, f'10 A={raw}')
        send_line(console, 'RUN')
        console.expect_exact('READY')
        diagnostics = re.findall(r'^LI \d+$', shared['normalize'](console.before), re.M)
        assert diagnostics == ['LI 10'], (raw, diagnostics)
        observations.append({'source': raw, 'diagnostic': diagnostics[0]})
    return observations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    change = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30-change.py')))
    shared = change['CAPTURE']
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    with shared['edu30'](simulator, tape) as console:
        tables = capture_scale_tables(console, shared['send_line'])
    accepted = []
    # Short independent listings keep the compiled constant table small.
    for index in range(0, len(ACCEPTED), 15):
        with shared['edu30'](simulator, tape) as console:
            accepted.extend(capture_accepted(
                console, shared, change['read_scalar_words'], ACCEPTED[index:index + 15],
            ))
    with shared['edu30'](simulator, tape) as console:
        rejected = capture_rejected(console, shared)

    evidence = {
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        **tables,
        'accepted': accepted,
        'rejected': rejected,
    }
    args.output.write_text(json.dumps(evidence, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
