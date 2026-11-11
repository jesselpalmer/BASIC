"""Check a stored-value numeric PRINT model against archived EDU30.SV fields."""

import argparse
import hashlib
import json
import runpy
from fractions import Fraction
from pathlib import Path


ARITHMETIC = runpy.run_path(str(Path(__file__).with_name('check-edusystem30-arithmetic.py')))
DOCS = Path(__file__).resolve().parents[2] / 'docs'


def format_field(value):
    if value == 0:
        return ' 0 '
    # PRINT multiplies by the literal at octal 03123 (0001,2000,0004).
    words = ARITHMETIC['truncate_to_words'](abs(value) * (1 + Fraction(1, 2**20)))
    fixed = -2 <= ARITHMETIC['components'](words)[1] <= 20
    decimal = ARITHMETIC['decode'](words)
    exponent = 0
    while decimal >= 10:
        decimal /= 10
        exponent += 1
    while decimal < 1:
        decimal *= 10
        exponent -= 1
    places = max(5, exponent) if fixed else 5
    digits = str(int(decimal * 10**places))
    point = exponent + 1 if fixed else 1
    whole = digits[:point] if point > 0 else ''
    fraction = digits[max(0, point):].rstrip('0')
    body = whole + ('.' + '0' * max(0, -point) + fraction if fraction else '')
    suffix = '' if fixed else f'E{exponent}'
    sign = '-' if value < 0 else ' '
    return f'{sign}{body}{suffix} '


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('print_capture', type=Path, nargs='?',
                        default=DOCS / 'edusystem30-print-reference.json')
    parser.add_argument('arithmetic_capture', type=Path, nargs='?',
                        default=DOCS / 'edusystem30-arithmetic-reference.json')
    args = parser.parse_args()
    capture = json.loads(args.print_capture.read_text(encoding='ascii'))
    arithmetic = json.loads(args.arithmetic_capture.read_text(encoding='ascii'))
    for identity in ('simulatorCommit', 'tapeSha256'):
        assert capture[identity] == arithmetic[identity]
    fields = capture['scalarProbe']['observations']
    for row in fields:
        value = ARITHMETIC['decode'](row['scalarWordsOctal'])
        assert format_field(value) == row['field'], row
        assert format_field(-value) == row['negatedField'], row
    cases = arithmetic['arithmeticProbe']['observations']
    assert len(cases) == capture['arithmeticProbe']['inputCount']
    output = []
    for row in cases:
        words = row['scalarWordsOctal']
        output.append('?' + ''.join(name + format_field(ARITHMETIC['decode'](words[name]))
                                    for name in 'APC') + '\n')
    output.append('?')
    digest = hashlib.sha256(''.join(output).encode('ascii')).hexdigest()
    assert digest == capture['arithmeticProbe']['outputSha256'], digest
    print(f'{2 * len(fields)} scalar fields and {3 * len(cases)} arithmetic fields match.')


if __name__ == '__main__':
    main()
