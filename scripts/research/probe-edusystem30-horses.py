"""Verify the indexed INPUT and FOR-body GOSUB used by the OMSI HORSES tape."""

import argparse
import json
from pathlib import Path
import runpy


INPUT_PROBE = {
    'name': 'indexed input',
    'source': '10 DIM T(3)\n20 S=2\n30 INPUT T(S)\n40 PRINT T(2)\n50 END',
    'output': '? 17 \n',
    'reply': '17',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--tape', required=True, type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    archive = runpy.run_path(str(directory / 'capture-edusystem30-omsi.py'))
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    transfer_reference = directory.parents[1] / 'docs' / 'horses-edu30-transfer-reference.json'
    transfer_probes = json.loads(transfer_reference.read_text())['probes']
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    for probe in [INPUT_PROBE, *transfer_probes]:
        name, source, expected = probe['name'], probe['source'], probe['output']
        reply = probe.get('reply')
        with archive['console_on_copies'](simulator, tape, shared) as console:
            def command(text, prompt):
                return archive['command'](console, shared, text, prompt)

            for line in source.splitlines():
                shared['send_line'](console, line)
            end = '\r\nREADY'
            output = command('RUN', '?' if reply else end)
            if reply:
                output += '?' + command(reply, end)
            banner = '\f\n\n*NONE*  EDUSYSTEM-30\n\n'
            assert output == banner + expected, (name, repr(output))
            print(name, repr(expected))


if __name__ == '__main__':
    main()
