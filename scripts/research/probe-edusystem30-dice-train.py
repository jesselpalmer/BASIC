"""Check DICE and TRAIN source compatibility against archived EDU30.SV."""

import argparse
import runpy
from pathlib import Path


FIXTURES = [
    ('dice', 'de62170bac304a92aaf766f6bc3bdb7232380cc3912d08595bfa00760970548a',
     'S1 140\nPC 150\nS1 224\n\n'),
    ('train', '08466c129864f4d474998caef2e2319f0280374e86915c658b4ea365db5df35d',
     'S1 10\nPC 15\nS1 20\nPC 25\nS1 105\n\n'),
]
PROBES = [
    ('bare RND', '10 PRINT INT(6*RND+1)\n20 END', 'S1 10\n\n'),
    ('RND()', '10 PRINT INT(6*RND()+1)\n20 END', 'S2 10\n\n'),
    ('RND(0)', '10 PRINT INT(6*RND(0)+1)\n20 END', ' 2 \n\n'),
    ('string INPUT', '10 INPUT A$\n20 END', 'S2 10\n\n'),
    ('string assignment', '10 A$="YES"\n20 END', 'S1 10\n\n'),
    ('string comparison', '10 IF A$="YES" THEN 20\n20 END', 'S1 10\n\n'),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    simulator = args.simulator.resolve()
    cases = list(PROBES)
    for name, sha256, expected in FIXTURES:
        source = (directory.parent / f'package/fixtures/classic/{name}-mar75-text.bas').read_bytes()
        assert shared['digest'](source) == sha256
        cases.append((name, source.decode('ascii'), expected))

    for name, source, expected in cases:
        with shared['edu30'](simulator, tape) as console:
            for line in [*source.splitlines(), 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('READY')
            output = shared['normalize'](console.before).split('EDUSYSTEM-30\n\n', 1)[1]
            assert output == expected, (name, repr(output))
            print(f'Verified {name}', flush=True)


if __name__ == '__main__':
    main()
