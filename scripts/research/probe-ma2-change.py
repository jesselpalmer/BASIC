"""Verify selected CHANGE behavior on reconstructed V4A-12 software MA2."""

import argparse
from importlib import import_module
from pathlib import Path
import re
import shutil
import tempfile

import pexpect


life2 = import_module('capture-life2-rsts')
PROBES = [
    (
        'prefix replacement',
        ['DIM A1(6)', 'A$="012"', 'CHANGE A$ TO A1', 'PRINT A1(0);A1(1);A1(2);A1(3)',
         'A$="9"', 'CHANGEA$TOA1', 'PRINT A1(0);A1(1);A1(2);A1(3)', 'A$=""',
         'CHANGE A$ TO A1', 'PRINT A1(0);A1(1);A1(2);A1(3)'],
        ' 3  48  49  50 \r\n 1  57  49  50 \r\n 0  57  49  50 \r\n\r\n',
    ),
    (
        'unsigned bytes',
        ['DIM A1(3)', 'A$=CHR$(0)+CHR$(128)+CHR$(255)', 'CHANGE A$ TO A1',
         'PRINT A1(0);A1(1);A1(2);A1(3)'],
        ' 3  0  128  255 \r\n\r\n',
    ),
    (
        'explicit capacity',
        ['DIM A1(2)', 'A1(0)=9:A1(1)=8:A1(2)=7', 'A$="123"', 'CHANGE A$ TO A1',
         'PRINT A1(0);A1(1);A1(2)'],
        'SUBSCRIPT OUT OF RANGE at line 40 \r\n\r\n',
    ),
    (
        'implicit bound',
        ['CHANGE A$ TO A1', 'PRINT A1(0);A1(10)', 'A$="0123456789"',
         'CHANGE A$ TO A1', 'PRINT A1(0);A1(10)', 'A$="0123456789A"', 'CHANGE A$ TO A1'],
        ' 0  0 \r\n 10  57 \r\nSUBSCRIPT OUT OF RANGE at line 70 \r\n\r\n',
    ),
]


def verify(console):
    life2.boot(console)
    for index, (description, statements, expected) in enumerate(PROBES):
        name = f'CHNG{index}'
        source = [f'{10 * i} {statement}' for i, statement in enumerate([*statements, 'END'], 1)]
        assert life2.enter_program(console, name, source) == []
        life2.enter(console, 'RUN')
        console.expect(re.compile(name + r' +[^\r\n]*\r\n'))
        console.expect_exact('Ready')
        assert console.before == expected, (description, repr(console.before))
        print(description)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--disk', required=True, type=Path)
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
            verify(console)


if __name__ == '__main__':
    main()
