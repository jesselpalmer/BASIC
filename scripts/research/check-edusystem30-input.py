"""Compare decimal INPUT conversion with words stored by archived EDU30.SV."""

import argparse
import json
import re
import runpy
from fractions import Fraction
from pathlib import Path


ARITHMETIC = runpy.run_path(str(Path(__file__).with_name('check-edusystem30-arithmetic.py')))
decode = ARITHMETIC['decode']
divide_words = ARITHMETIC['divide_words']
truncate_to_words = ARITHMETIC['truncate_to_words']
NUMBER = re.compile(r'([+-]?)(\d*)(?:\.(\d*))?(?:[Ee]([+-]?\d+))?', re.ASCII)


def accumulate_digits(digits):
    words = truncate_to_words(Fraction(0))
    for digit in digits:
        product = truncate_to_words(decode(words) * 10)
        words = truncate_to_words(decode(product) + int(digit))
    return words


def scale(words, exponent):
    blocks, units = divmod(abs(exponent), 8)
    for factor, repetitions in ((10**8, blocks), (10, units)):
        if repetitions == 0:
            continue
        factor_words = truncate_to_words(Fraction(factor))
        for _ in range(repetitions):
            if exponent < 0:
                words = divide_words(words, factor_words)
            else:
                words = truncate_to_words(decode(words) * factor)
    return words


def input_words(text):
    match = NUMBER.fullmatch(text)
    if match is None or not any(match.groups()[1:3]):
        raise ValueError(f'Expected a complete decimal field: {text!r}')
    sign, whole, fraction, exponent = match.groups()
    fraction = fraction or ''
    integer_words = accumulate_digits(whole)
    fraction_words = scale(accumulate_digits(fraction), -len(fraction))
    combined = truncate_to_words(decode(integer_words) + decode(fraction_words))
    scaled = scale(combined, int(exponent or 0))
    return truncate_to_words(-decode(scaled)) if sign == '-' else scaled


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_capture', type=Path)
    parser.add_argument('arithmetic_capture', type=Path)
    args = parser.parse_args()
    direct = json.loads(args.input_capture.read_text(encoding='ascii'))
    arithmetic = json.loads(args.arithmetic_capture.read_text(encoding='ascii'))
    assert (direct['simulatorCommit'], direct['tapeSha256']) == (
        arithmetic['simulatorCommit'], arithmetic['tapeSha256'],
    )
    observations = direct['inputProbe']['observations']
    arithmetic_observations = arithmetic['arithmeticProbe']['observations']
    assert observations and arithmetic_observations
    for sample in observations:
        expected = input_words(sample['input'])
        assert expected == sample['wordsOctal'], (sample, expected)
    for observation in arithmetic_observations:
        for text, scalar in zip(observation['inputs'], ('A', 'P')):
            expected = input_words(text)
            actual = observation['scalarWordsOctal'][scalar]
            assert expected == actual, (text, expected, actual)
    print(f'{len(observations) + 2 * len(arithmetic_observations)} decimal INPUT values match all three archived words.')


if __name__ == '__main__':
    main()
