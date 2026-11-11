"""Compare exact dyadic arithmetic with EDU30.SV scalar word captures."""

import argparse
import json
from fractions import Fraction
from pathlib import Path


WORD_BITS = 12
SIGNIFICAND_BITS = 23
WORD_MASK = (1 << WORD_BITS) - 1


def signed(value, bits):
    sign = 1 << (bits - 1)
    return (value ^ sign) - sign


def components(words):
    exponent, high, low = (int(word, 8) for word in words)
    exponent = signed(exponent, WORD_BITS)
    significand = signed((high << WORD_BITS) | low, 2 * WORD_BITS)
    return significand, exponent


def decode(words):
    significand, exponent = components(words)
    return significand * Fraction(2) ** (exponent - SIGNIFICAND_BITS)


def divide_words(dividend_words, divisor_words):
    dividend, dividend_exponent = components(dividend_words)
    divisor, divisor_exponent = components(divisor_words)
    quotient, remainder = divmod(abs(dividend) << (SIGNIFICAND_BITS - 1), abs(divisor))
    if (dividend < 0) != (divisor < 0):
        quotient = -quotient
    # The archived routine rotates the high remainder word twice through
    # Link, then adds the high word of the negated divisor. The final Link
    # bit is added to the signed quotient.
    remainder_high = remainder >> WORD_BITS
    negative_divisor_high = (-abs(divisor) >> WORD_BITS) & WORD_MASK
    quotient += ((4 * remainder_high + negative_divisor_high) >> WORD_BITS) & 1
    exponent = dividend_exponent - divisor_exponent - (SIGNIFICAND_BITS - 1)
    return truncate_to_words(quotient * Fraction(2) ** exponent)


def truncate_to_words(value):
    if value == 0:
        return ['0000', '0000', '0000']

    magnitude = abs(value)
    exponent = magnitude.numerator.bit_length() - magnitude.denominator.bit_length() + 1
    if magnitude < Fraction(2) ** (exponent - 1):
        exponent -= 1
    if not -(1 << (WORD_BITS - 1)) <= exponent < (1 << (WORD_BITS - 1)):
        raise OverflowError('Value is outside the range of the signed exponent')
    significand = int(value / Fraction(2) ** (exponent - SIGNIFICAND_BITS))
    return [
        f'{exponent & WORD_MASK:04o}',
        f'{(significand >> WORD_BITS) & WORD_MASK:04o}',
        f'{significand & WORD_MASK:04o}',
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture', type=Path)
    args = parser.parse_args()
    capture = json.loads(args.capture.read_text(encoding='ascii'))
    observations = capture['arithmeticProbe']['observations']
    assert observations, 'Expected at least one archived arithmetic observation'
    division_differences = 0
    for observation in observations:
        words = observation['scalarWordsOctal']
        a, p = decode(words['A']), decode(words['P'])
        for name, value in {'C': p - a, 'F': p + a, 'N': p * a}.items():
            expected = truncate_to_words(value)
            assert expected == words[name], (observation['inputs'], name, expected, words[name])
        if truncate_to_words(p / a) != words['G']:
            division_differences += 1
        quotient = divide_words(words['P'], words['A'])
        assert quotient == words['G'], (observation['inputs'], quotient, words['G'])
    print(f'{len(observations)} cases match all three words for each arithmetic operation.')
    print(f'Truncating the exact quotient differs in {division_differences} of {len(observations)} cases.')


if __name__ == '__main__':
    main()
