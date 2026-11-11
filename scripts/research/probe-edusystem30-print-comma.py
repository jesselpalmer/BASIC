"""Capture PRINT comma columns and terminal bytes on archived EDU30.SV."""

import argparse
import json
import runpy
from pathlib import Path


PROBES = (
    ('zone stops', (
        '10 PRINT 1,2,3,4,5,6,7',
        '20 PRINT "ABC",4',
        '30 PRINT "ABCDEFGHIJKLMNO",5',
        '40 PRINT TAB(55),"A"',
        '50 PRINT TAB(56),"B"',
        '60 PRINT TAB(68);"ABC";',
        '70 PRINT ,"C"',
        '80 PRINT TAB(56),,"D"',
        '90 END',
    ), ()),
    ('continued output', (
        '10 PRINT ,"A"',
        '20 PRINT "A",,"B"',
        '30 PRINT ,,"C"',
        '40 PRINT "A",,',
        '50 PRINT "B"',
        '60 PRINT ,',
        '70 PRINT "D"',
        '80 PRINT "X",',
        '90 PRINT "Y"',
        '100 PRINT "Z";',
        '110 PRINT ,5',
        '120 PRINT "E",',
        '130 END',
    ), ()),
    ('input prompts', (
        r'10 PRINT "A",\INPUT I\PRINT I',
        r'20 PRINT TAB(56),\INPUT J',
        r'30 PRINT "ABC",\INPUT K\PRINT "Z"',
        '40 END',
    ), ('8', '9,10')),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    captured = []
    for name, source, answers in PROBES:
        chunks = []
        with shared['edu30'](args.simulator.resolve(), tape) as console:
            for line in (*source, 'RUN'):
                shared['send_line'](console, line)
            console.expect_exact('EDUSYSTEM-30\r\n\r\n')
            for answer in answers:
                console.expect_exact('?')
                chunks.append(console.before + '?')
                shared['send_line'](console, answer)
            console.expect_exact('READY')
            chunks.append(console.before)
        output = ''.join(chunks)
        assert output.endswith('\0\r\n'), repr(output)
        captured.append({'name': name, 'source': source, 'answers': answers, 'output': output})
    print(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'probes': captured,
    }, indent=2))


if __name__ == '__main__':
    main()
