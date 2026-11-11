"""Compare DIAMND's compiled constants and verify the debugger-only repair."""

import argparse
import json
import re
import runpy
from pathlib import Path


CONSTANTS = {
    1: ('10403', '10404', '10405'),
    70: ('10406', '10407', '10410'),
    60: ('10411', '10412', '10413'),
    2: ('10414', '10415', '10416'),
    3: ('10417', '10420', '10421'),
}
EXPECTED_WORDS = {
    1: ('0001', '2000', '0000'),
    70: ('0007', '2140', '0000'),
    60: ('0006', '3600', '0000'),
    2: ('0002', '2000', '0000'),
    3: ('0002', '3000', '0000'),
}


def command(console, instruction):
    console.sendline(instruction)
    console.expect_exact('sim> ')
    assert '%SIM-ERROR' not in console.before, console.before
    return console.before


def words(console, addresses):
    output = command(console, 'examine ' + ','.join(addresses))
    values = dict(re.findall(r'^([0-7]+):\s+([0-7]{4})\r?$', output, re.M))
    return tuple(values[address] for address in addresses)


def resume(console):
    console.sendline('continue')
    console.expect_exact('continue\r\n')


def capture(console, shared, lines, size, replacement=None):
    send_line = shared['send_line']
    for line in lines:
        send_line(console, line)
    send_line(console, 'RUN')
    console.expect_exact('?')
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    table = {value: words(console, addresses) for value, addresses in CONSTANTS.items()}

    if replacement is not None:
        for value, addresses in CONSTANTS.items():
            for address, before, after in zip(addresses, table[value], replacement[value], strict=True):
                if before != after:
                    command(console, f'deposit {address} {after}')

    # At the breakpoint CDF 1 has selected the data field and octal 11
    # holds the pre-increment pointer to the three-word constant for 60.
    command(console, 'break 00322')
    resume(console)
    send_line(console, str(size))
    console.expect_exact('Breakpoint, PC: 00322')
    console.expect_exact('sim> ')
    assert words(console, ('2', '11')) == ('0006', '0410')
    command(console, 'step 7')
    loaded = words(console, ('25', '26', '27'))
    command(console, 'nobreak 00322')
    if loaded != EXPECTED_WORDS[60]:
        # The line-entry opcode reads the source line number into octal 2.
        command(console, 'break 00676')
        for line in ('0010', '0143'):
            resume(console)
            console.expect_exact('Breakpoint, PC: 00676')
            console.expect_exact('sim> ')
            command(console, 'step 2')
            assert words(console, ('2', '17572', '17573', '17574')) == (line, '0000', '0000', '0000')
        command(console, 'nobreak 00676')
    resume(console)
    console.expect_exact('READY')
    output = shared['normalize'](console.before).removeprefix('continue\n')
    return table, loaded, output.strip('\n').splitlines()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    original_probe = runpy.run_path(str(directory / 'probe-edusystem30-diamnd.py'))
    tape = args.tape.resolve()
    simulator = args.simulator.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixture = (
        directory.parent / 'package/fixtures/classic/diamnd-mar75-text.bas'
    ).read_bytes()
    assert shared['digest'](fixture) == original_probe['SOURCE_SHA256']
    source = fixture.decode('ascii').splitlines()
    insertion = source.index('60 PRINT') + 1
    marked_source = [*source[:insertion], '61 PRINT "PRINTED"', *source[insertion:]]
    diamond_rows = original_probe['diamond_rows']

    with shared['edu30'](simulator, tape) as console:
        original, loaded, output = capture(console, shared, source, 15)
        assert loaded == original[60] == EXPECTED_WORDS[1] and output == [], (loaded, output)
    with shared['edu30'](simulator, tape) as console:
        marked, loaded, output = capture(console, shared, marked_source, 15)
        assert marked == EXPECTED_WORDS and loaded == marked[60], marked
        assert output[::2] == diamond_rows(15) and output[1::2] == ['PRINTED'] * 60, output
    assert {value for value in marked if original[value] != marked[value]} == {70, 60, 2, 3}

    repaired_rows = {}
    for size in (5, 15, 31):
        with shared['edu30'](simulator, tape) as console:
            before, loaded, output = capture(console, shared, source, size, replacement=marked)
            assert before == original and loaded == marked[60], (before, loaded)
            assert output == diamond_rows(size), (size, output)
            repaired_rows[size] = len(output)

    print(json.dumps({
        'originalConstantWords': original,
        'markedConstantWords': marked,
        'repairedOriginalRowsBySize': repaired_rows,
    }, indent=2))


if __name__ == '__main__':
    main()
