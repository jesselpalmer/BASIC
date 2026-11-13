"""Check NICOMA source compatibility against archived EDU30.SV."""

import argparse
import runpy
from pathlib import Path


SOURCE_SHA256 = '0d92549b3d7adcbfef3c2ce797574f4efe8c17246e6588610b3d3f4a6c2f44e8'
PROBES = [
    ('SLEEP', '10 SLEEP(5)\n20 END', 'S1 10\n\n'),
    ('string INPUT', '10 INPUT A$\n20 END', 'S2 10\n\n'),
    ('string comparison', '10 IF A$="YES" THEN 20\n20 END', 'S1 10\n\n'),
    ('string PRINT interpolation', '10 PRINT "GOT "A$\n20 END', 'S2 10\n\n'),
    ('numeric core', '\n'.join([
        '10 A=3', '20 B=0', '30 C=5',
        '40 D=70*A+21*B+15*C', '50 IF D<=105 THEN 80', '60 D=D-105', '70 GOTO 50',
        '80 PRINT "YOUR NUMBER WAS"D", RIGHT"', '90 END',
    ]), 'YOUR NUMBER WAS 75 , RIGHT\n\n'),
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
    listing = (directory.parent / 'package/fixtures/classic/nicoma-mar75-text.bas').read_bytes()
    assert shared['digest'](listing) == SOURCE_SHA256
    cases = [*PROBES, ('full listing', listing.decode('ascii'), 'S1 90\nS1 170\nS1 180\n\n')]

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
