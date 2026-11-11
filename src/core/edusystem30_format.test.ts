import {expect, test} from 'bun:test';
import {createHash} from 'node:crypto';
import arithmeticReference from '../../docs/edusystem30-arithmetic-reference.json';
import printReference from '../../docs/edusystem30-print-reference.json';
import remainderReference from '../../docs/edusystem30-print-remainder-reference.json';
import type {EduSystem30FloatingValue} from './edusystem30_floating.ts';
import {formatEduSystem30Number} from './edusystem30_format.ts';

function decode(words: readonly string[]): EduSystem30FloatingValue {
  const [exponent, high, low] = words.map((word) => BigInt(`0o${word}`));
  return {
    significand: BigInt.asIntN(24, (high << 12n) | low),
    exponent: Number(BigInt.asIntN(12, exponent)),
  };
}

test('EDUSYSTEM-30 PRINT matches archived scalar fields and negations', () => {
  for (const {scalarWordsOctal, field, negatedField} of printReference.scalarProbe.observations) {
    const value = decode(scalarWordsOctal);
    expect(formatEduSystem30Number(value)).toBe(field);
    expect(formatEduSystem30Number({...value, significand: -value.significand})).toBe(negatedField);
  }
});

test('EDUSYSTEM-30 PRINT matches archived arithmetic field output', () => {
  const cases = arithmeticReference.arithmeticProbe.observations;
  expect(cases).toHaveLength(printReference.arithmeticProbe.inputCount);
  const output = cases.map(({scalarWordsOctal: words}) => {
    const fields = (['A', 'P', 'C'] as const).map(
      (name) => name + formatEduSystem30Number(decode(words[name])),
    );
    return `?${fields.join('')}\n`;
  });
  expect(
    createHash('sha256')
      .update(output.join('') + '?')
      .digest('hex'),
  ).toBe(printReference.arithmeticProbe.outputSha256);
});

test('EDUSYSTEM-30 PRINT terminates fractional digits at the archived remainder cutoff', () => {
  for (const {scalarWordsOctal, field} of remainderReference.remainderProbe.observations)
    expect(formatEduSystem30Number(decode(scalarWordsOctal.C))).toBe(field);
});
