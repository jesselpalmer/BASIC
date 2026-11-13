"""Capture selected V4A-12 software MA2 RND from the reconstructed scratch RK05."""

import argparse
import json
from pathlib import Path
import shutil
import tempfile

import pexpect

from importlib import import_module


life2 = import_module('capture-life2-rsts')
SCALED = [25265, 25619, 24633, 15531, 2561, 6659, 16905, 8731, 31313, 10995, 13529, 14987]
SOURCE = [
    '10 FOR I=1 TO 12',
    '20 A=RND*32768',
    '30 PRINT INT(A);INT(32768*(A-INT(A)))',
    '40 NEXT I',
    '50 END',
]


def capture(console):
    life2.boot(console)
    assert life2.enter_program(console, 'RNDOBS', SOURCE) == []

    def run():
        life2.enter(console, 'RUN')
        console.expect(r'RNDOBS +[^\r\n]*\r\n')
        console.expect_exact('Ready')
        values = []
        for line in console.before.splitlines():
            if line:
                high, low = map(int, line.split())
                assert low == 0 and 0 < high < 32768 and high & 1, line
                values.append(high)
        assert len(values) == len(SCALED)
        return values

    bare = run()
    assert run() == bare == SCALED
    life2.enter(console, '20 A=RND(I-2)*32768')
    assert run() == bare
    life2.enter(console, '5 RANDOMIZE')
    randomized = run()
    # Clock contents are not pinned. Check the post-RANDOMIZE recurrence, not
    # a particular first value or a particular host/guest time correspondence.
    assert all(
        (31747 * before) % 32768 == after
        for before, after in zip(randomized, randomized[1:])
    )
    return {
        'schemaVersion': 1,
        'build': life2.BUILD,
        'simulatorCommit': life2.SIMH_COMMIT,
        'source': SOURCE,
        'scale': 32768,
        'scaledDefaultValues': bare,
        'identicalOnFreshRun': True,
        'identicalWithArgumentsFromMinusOneThroughTen': True,
        'randomizedDrawsFollowSameRecurrence': True,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--disk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    assert args.disk.stat().st_size == 2494464, 'Expected a raw RK05 disk before REFRESH'
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copyfile(args.disk, root / 'working.dsk')
        (root / 'boot.ini').write_text(
            'SET CPU 11/05\nSET CPU 64K\nSET CLK 60HZ\nSET RK ENABLED\n'
            'ATTACH RK0 working.dsk\nBOOT RK0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(args.simulator.resolve()), ['boot.ini'], cwd=directory, encoding='ascii',
            timeout=20,
        ) as console:
            reference = capture(console)
    args.output.write_text(json.dumps(reference, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
