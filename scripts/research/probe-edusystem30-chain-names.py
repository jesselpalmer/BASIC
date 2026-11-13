"""Verify CHAIN tape-name handling on the pinned two-drive EDU30.SV archive."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import runpy


CASES = [
    ('DEMON', True),
    ('DEMON ', True),
    ('DEMON  ', True),
    ('DEMON XYZ', True),
    ('DEMONX', False),
    (' DEMON', False),
    ('DE MON', False),
    ('DE!ON ', False),
    ('', False),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    omsi = runpy.run_path(str(directory / 'capture-edusystem30-omsi.py'))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']

    def verify(case):
        name, found = case
        with omsi['console_on_copies'](simulator, tape, shared) as console:
            shared['send_line'](console, f'10 CHAIN "{name}"')
            shared['send_line'](console, '20 END')
            omsi['command'](console, shared, 'RUN', 'EDUSYSTEM-30\r\n\r\n')
            result = console.expect_exact([omsi['MENU'], 'READY'])
            if found:
                assert result == 0, repr(console.before)
            else:
                assert result == 1, repr(console.before)
                assert shared['normalize'](console.before) == '\nERROR CH AT LINE 0010\n\n'
        return name, found

    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, found in pool.map(verify, CASES):
            print(f'{name!r}: {"DEMON" if found else "ERROR CH AT LINE 0010"}')


if __name__ == '__main__':
    main()
