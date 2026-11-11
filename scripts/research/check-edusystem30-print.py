"""Check a stored-value numeric PRINT model against archived EDU30.SV fields."""

import argparse
import hashlib
import json
import runpy
from fractions import Fraction
from pathlib import Path


ARITHMETIC = runpy.run_path(str(Path(__file__).with_name('check-edusystem30-arithmetic.py')))
DOCS = Path(__file__).resolve().parents[2] / 'docs'


def truncate(value):
    return ARITHMETIC['decode'](ARITHMETIC['truncate_to_words'](value))


def binary_exponent(value):
    return ARITHMETIC['components'](ARITHMETIC['truncate_to_words'](value))[1]


def divide(left, right):
    words = ARITHMETIC['divide_words'](
        ARITHMETIC['truncate_to_words'](left), ARITHMETIC['truncate_to_words'](right),
    )
    return ARITHMETIC['decode'](words)


def scale(value, places):
    operation = divide if places < 0 else lambda left, right: truncate(left * right)
    groups, remaining = divmod(abs(places), 8)
    for _ in range(groups):
        value = operation(value, 10**8)
    for _ in range(remaining):
        value = operation(value, 10)
    return value


def scientific(value):
    exponent = binary_exponent(value)
    # Octal 03430–03457 uses the 12-bit approximation of log10(2).
    places = ((1 - exponent) * 0o2321 // 4096 if exponent < 0
              else -(exponent * 0o2321 // 4096) - 1)
    value = scale(value, places)
    while value < 1:
        value = truncate(value * 10)
        places += 1
    return value, -places


def format_field(value):
    if value == 0:
        return ' 0 '
    # PRINT multiplies by the literal at octal 03123 (0001,2000,0004).
    adjusted = truncate(abs(value) * (1 + Fraction(1, 2**20)))
    suffix = ''
    if not -2 <= binary_exponent(adjusted) <= 20:
        adjusted, exponent = scientific(adjusted)
        suffix = f'E{exponent}'
    whole = str(int(adjusted)) if adjusted >= 1 else ''
    remainder = truncate(adjusted - int(adjusted))
    fraction = ''
    # At octal 03562–03573, stop when E + 18 - 3 * printed digits <= 0.
    while remainder and binary_exponent(remainder) > 3 * (len(whole) + len(fraction)) - 18:
        remainder = truncate(remainder * 10)
        digit = int(remainder)
        fraction += str(digit)
        remainder = truncate(remainder - digit)
    body = whole + ('.' + fraction if fraction else '')
    sign = '-' if value < 0 else ' '
    return f'{sign}{body}{suffix} '


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('print_capture', type=Path, nargs='?',
                        default=DOCS / 'edusystem30-print-reference.json')
    parser.add_argument('arithmetic_capture', type=Path, nargs='?',
                        default=DOCS / 'edusystem30-arithmetic-reference.json')
    parser.add_argument('remainder_capture', type=Path, nargs='?',
                        default=DOCS / 'edusystem30-print-remainder-reference.json')
    args = parser.parse_args()
    capture = json.loads(args.print_capture.read_text(encoding='ascii'))
    arithmetic = json.loads(args.arithmetic_capture.read_text(encoding='ascii'))
    remainder = json.loads(args.remainder_capture.read_text(encoding='ascii'))
    for identity in ('simulatorCommit', 'tapeSha256'):
        assert capture[identity] == arithmetic[identity] == remainder[identity]
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
    remainders = remainder['remainderProbe']['observations']
    for row in remainders:
        a, p, c = (ARITHMETIC['decode'](row['scalarWordsOctal'][name]) for name in 'APC')
        assert c == truncate(p - a), row
        assert format_field(c) == row['field'], row
    print(f'{2 * len(fields)} scalar, {3 * len(cases)} arithmetic and '
          f'{len(remainders)} remainder fields match.')


if __name__ == '__main__':
    main()
