"""Capture common and leap calendars on archived EDU30.SV."""

import argparse
import calendar
import json
import re
import runpy
from pathlib import Path


RAW_SHA = 'c42b11a6afdcda9815b2d91d8b1a379a615451f7bdf47153d0175fcf01f422ef'
PRINTED_SHA = '28295713e543a2c1314744308cb3a407da4979c0ddd226832c3fce749740cea4'
SOURCE_SHA = '67a5c54ea9f556830e04192b88f7dcad7ec51531fd9f7b6260268c0165e3f706'
TAPE_NOTICE = 'DT0: writing buffer to file: working.tu56\n'
HEADER = re.compile(r'^\*\* (\d+) +\*{18} *([A-Z]+) *\*{18} (\d+) \*\*$', re.M)


def capture(console, shared, source):
    send = shared['send_line']
    console.delaybeforesend = 0.01
    for line in source.splitlines():
        send(console, line)
    send(console, 'RUN')
    console.expect_exact('EDUSYSTEM-30\r\n\r\n')
    console.expect_exact('\x00\r\nREADY')
    return console.before.replace('\r\n', '\n').replace(TAPE_NOTICE, '')


def verify_calendar(output, year):
    headers = list(HEADER.finditer(output))
    assert len(headers) == 12, repr(output[:200])
    elapsed = 0
    for month, header in enumerate(headers, 1):
        assert header.groups() == (str(elapsed), calendar.month_name[month].upper(),
                                   str(365 + calendar.isleap(year) - elapsed))
        end = headers[month].start() if month < 12 else len(output)
        weeks = []
        for line in output[header.end():end].splitlines():
            if re.search(r'\d', line):
                week = [0] * 7
                for day in re.finditer(r'\d+', line):
                    assert day.start() in range(5, 54, 8), repr(line)
                    week[(day.start() - 5) // 8] = int(day[0])
                weeks.append(week)
        assert weeks == calendar.Calendar(calendar.SUNDAY).monthdayscalendar(year, month), (month, weeks)
        elapsed += calendar.monthrange(year, month)[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    shared = runpy.run_path(str(Path(__file__).with_name('capture-edusystem30.py')))
    tape = args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']
    fixtures = Path(__file__).resolve().parents[1] / 'package/fixtures/classic'

    def read(name, digest):
        data = (fixtures / name).read_bytes()
        assert shared['digest'](data) == digest
        return data.decode('ascii')

    read('calndr.bas', RAW_SHA)
    printed = read('calndr-mar75-text.bas', PRINTED_SHA)
    source = read('calndr-edusystem30.bas', SOURCE_SHA)
    with shared['edu30'](args.simulator.resolve(), tape) as console:
        diagnostics = capture(console, shared, printed).splitlines()
    assert diagnostics == ['S1 220', 'UQ 390', 'S1 510'], diagnostics
    leap_edits = [['130 D=-1', '130 D=0'], ['360 PRINT 365-S', '360 PRINT 366-S'],
                  ['620 DATA 0,31,28', '620 DATA 0,31,29']]
    runs = []
    for year, edits in [(1973, []), (1984, leap_edits)]:
        program = source
        for original, replacement in edits:
            assert program.count(original) == 1
            program = program.replace(original, replacement)
        with shared['edu30'](args.simulator.resolve(), tape) as console:
            output = capture(console, shared, program)
        verify_calendar(output, year)
        runs.append({'year': year, 'edits': edits, 'outputSha256': shared['digest'](output.encode('ascii'))})
    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'rawFixtureSha256': RAW_SHA,
        'printedFixtureSha256': PRINTED_SHA,
        'fixtureSha256': SOURCE_SHA,
        'printedDiagnostics': diagnostics,
        'runs': runs,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
