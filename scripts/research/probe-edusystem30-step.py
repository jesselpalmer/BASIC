"""Check signed FOR STEP and unary signs on archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    tape = args.tape.resolve()
    simulator = args.simulator.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    path = directory.parents[1] / 'docs/edusystem30-step-reference.json'
    reference = json.loads(path.read_text(encoding='ascii'))
    probes = [*reference['probes'], {'name': 'zero step', **reference['zeroStepProbe']}]

    for probe in probes:
        with shared['edu30'](simulator, tape) as console:
            for line in [*probe['source'].splitlines(), 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('READY')
            output = shared['normalize'](console.before).split('EDUSYSTEM-30\n\n', 1)[1]
            assert output == probe['output'] + '\n', (probe['name'], output)
            print(f"Verified {probe['name']}", flush=True)


if __name__ == '__main__':
    main()
