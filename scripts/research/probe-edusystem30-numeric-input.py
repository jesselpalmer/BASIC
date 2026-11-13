"""Verify indexed numeric INPUT against the pinned EDU30.SV archive."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import runpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--tape', required=True, type=Path)
    args = parser.parse_args()
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    reference = directory.parents[1] / 'docs' / 'edusystem30-indexed-input-reference.json'
    probes = json.loads(reference.read_text(encoding='ascii'))['probes']
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']

    def verify(probe):
        with shared['edu30'](simulator, tape) as console:
            console.delaybeforesend = 0.01
            for line in [*probe['source'], 'RUN']:
                shared['send_line'](console, line)
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            output = []
            for answer in probe['answers']:
                console.expect_exact('?')
                output.append(console.before + '?')
                shared['send_line'](console, answer)
            console.expect_exact('\r\nREADY')
            output.append(console.before)
            actual = shared['normalize'](''.join(output))
            assert actual == probe['output'], (probe['name'], actual, probe['output'])
            return probe['name']

    with ThreadPoolExecutor() as executor:
        for name in executor.map(verify, probes):
            print(name)


if __name__ == '__main__':
    main()
