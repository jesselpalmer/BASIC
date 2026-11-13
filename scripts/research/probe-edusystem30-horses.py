"""Verify the indexed INPUT and FOR-body GOSUB used by the OMSI HORSES tape."""

import argparse
from pathlib import Path
import runpy


PROBES = (
    ('indexed input',
     ('10 DIM T(3)', '20 S=2', '30 INPUT T(S)', '40 PRINT T(2)', '50 END'),
     '? 17 \n'),
    ('never entered',
     ('10 GOSUB 40', '20 GOTO 80', '30 FOR I=1 TO 2', '40 PRINT "SUBROUTINE";I',
      '50 RETURN', '60 NEXT I', '80 END'),
     'SUBROUTINE 0 \n'),
    ('completed',
     ('10 FOR I=1 TO 2', '20 GOTO 50', '30 PRINT "SUBROUTINE";I', '40 RETURN',
      '50 NEXT I', '60 GOSUB 30', '70 END'),
     'SUBROUTINE 2 \n'),
    ('active',
     ('10 FOR I=1 TO 2', '20 GOSUB 40', '30 GOTO 60', '40 PRINT "SUBROUTINE";I',
      '50 RETURN', '60 NEXT I', '70 END'),
     'SUBROUTINE 1 \nSUBROUTINE 2 \n'),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', required=True, type=Path)
    parser.add_argument('--tape', required=True, type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    archive = runpy.run_path(str(directory / 'capture-edusystem30-omsi.py'))
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    for name, source, expected in PROBES:
        with archive['console_on_copies'](simulator, tape, shared) as console:
            def command(text, prompt):
                return archive['command'](console, shared, text, prompt)

            for line in source:
                shared['send_line'](console, line)
            end = '\r\nREADY'
            output = command('RUN', '?' if name == 'indexed input' else end)
            if name == 'indexed input':
                output += '?' + command('17', end)
            banner = '\f\n\n*NONE*  EDUSYSTEM-30\n\n'
            assert output == banner + expected, (name, repr(output))
            print(name, repr(expected))


if __name__ == '__main__':
    main()
