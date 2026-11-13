"""Capture seeded EDUSYSTEM-30 RNG words across signed and wrapped seed boundaries."""

import argparse
import json
from pathlib import Path
import re
import runpy


# Last positive initial high word, first negative, the EVEN1 clock,
# last negative before wrap, then first wrapped positive high word.
CLOCK_WORDS = [1230, 1231, 1246, 1744, 3278, 3279]
SOURCE = '10 RANDOMIZE\n20 FOR I=1 TO 4\n30 X=RND(0)\n40 NEXT I\n50 END'


def command(console, text):
    console.sendline(text)
    console.expect_exact('sim> ')
    return console.before


def resume(console):
    console.sendline('continue')
    console.expect_exact('continue\r\n')


def breakpoint(console, address):
    console.expect_exact(f'Breakpoint, PC: {address}')
    console.expect_exact('sim> ')


def state(console):
    output = command(console, 'examine 150-151')
    words = re.search(r'150:\s+([0-7]{4})\r\n151:\s+([0-7]{4})\r\n', output)
    assert words, repr(output)
    return ''.join(words.groups())


def capture(console, shared, clock_word):
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    command(console, 'break 02755')
    resume(console)
    shared['send_line'](console, 'RUN')
    breakpoint(console, '02755')
    assert state(console) == '14613007'
    command(console, f'deposit 7471 {clock_word:o}')
    command(console, 'nobreak 02755')
    command(console, 'break 03532')
    console.sendline('continue')
    breakpoint(console, '03532')
    initial = state(console)
    command(console, 'nobreak 03532')
    command(console, 'break 03554')
    draws = []
    for _ in range(4):
        console.sendline('continue')
        breakpoint(console, '03554')
        draws.append(state(console))
    command(console, 'nobreak 03554')
    resume(console)
    console.expect_exact('READY')
    return {'clockWord': clock_word, 'initialStateOctal': initial, 'drawStatesOctal': draws}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        for line in SOURCE.splitlines():
            shared['send_line'](console, line)
        observations = [capture(console, shared, word) for word in CLOCK_WORDS]

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'source': SOURCE,
        'observations': observations,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
