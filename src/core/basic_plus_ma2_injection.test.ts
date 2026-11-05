import {describe, expect, test} from 'bun:test';
import {injectBasicPlusMa2} from './basic_plus_ma2_injection.ts';
import {observeBasicPlusMa2} from './basic_plus_ma2_values.ts';
import {basicPlusMa2DecimalLiteral} from './basic_plus_ma2_decimal.ts';
import reference from './__tests__/ma2-values-reference.json';

// Independent exact rational construction from selected-machine words, rather
// than reversing the injection implementation's binary64 field operations.
function rational(words: readonly number[]): number {
  const [high, low] = words;
  if (high === 0 && low === 0) return 0;
  const significand = 8388608 + (high % 128) * 65536 + low;
  return (high >= 32768 ? -1 : 1) * significand * 2 ** ((Math.floor(high / 128) % 256) - 152);
}
function adjacent(value: number, step: bigint): number {
  const buffer = new DataView(new ArrayBuffer(8));
  buffer.setFloat64(0, value);
  buffer.setBigUint64(0, buffer.getBigUint64(0) + step);
  return buffer.getFloat64(0);
}
const captured = [
  ...new Map(
    reference.unaryRows
      .flatMap((row) => [row.input, row.output])
      .map((words) => [words.join(','), words]),
  ).values(),
];

describe('internal exact selected-MA2 host injection', () => {
  test.each(captured.map((words, index) => [index, words] as const))(
    'injects captured canonical value %i exactly',
    (_index, words) => {
      expect(injectBasicPlusMa2(rational(words))).toEqual({
        kind: 'value',
        words: [words[0], words[1]],
      });
    },
  );
  test('accepts exact rationals across every stored exponent, both signs and fraction boundaries', () => {
    for (let exponent = 1; exponent <= 255; exponent++) {
      for (const fraction of [0, 1, 0x3fffff, 0x7ffffe, 0x7fffff]) {
        for (const sign of [0, 32768]) {
          const words = [sign + exponent * 128 + Math.floor(fraction / 65536), fraction % 65536];
          const exact = rational(words);
          expect(injectBasicPlusMa2(exact)).toEqual({kind: 'value', words: [words[0], words[1]]});
          expect(observeBasicPlusMa2(words)).toEqual({kind: 'value', value: exact});
        }
      }
    }
  });
  test('rejects extra binary64 significand bits without rounding or decimal parsing', () => {
    for (const value of [0.1, -0.1, 1.0000001, -1.0000001, Math.PI, 16777217, -16777217])
      expect(injectBasicPlusMa2(value)).toEqual({kind: 'unsupported', reason: 'precision'});
    for (const words of [
      [0x4080, 0],
      [0x4180, 1],
      [0xc080, 0],
      [0x0080, 1],
    ]) {
      const value = rational(words);
      for (const step of [-1n, 1n])
        expect(injectBasicPlusMa2(adjacent(value, step))).toEqual({
          kind: 'unsupported',
          reason: 'precision',
        });
    }
    expect(injectBasicPlusMa2(1 + 2 ** -23)).toEqual({kind: 'value', words: [0x4080, 1]});
    expect(basicPlusMa2DecimalLiteral('1.00000011920928955078125')).toEqual({
      kind: 'value',
      words: [0x4080, 0],
    });
  });
  test('checks magnitude endpoints before precision and never underflows to zero', () => {
    const minimum = 2 ** -128,
      maximum = (2 ** 24 - 1) * 2 ** 103;
    expect(injectBasicPlusMa2(minimum)).toEqual({kind: 'value', words: [0x0080, 0]});
    expect(injectBasicPlusMa2(maximum)).toEqual({kind: 'value', words: [0x7fff, 65535]});
    for (const value of [
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      2 ** -129,
      2 ** 127,
      adjacent(minimum, -1n),
      adjacent(maximum, 1n),
    ]) {
      expect(injectBasicPlusMa2(value)).toEqual({kind: 'unsupported', reason: 'range'});
      expect(injectBasicPlusMa2(-value)).toEqual({kind: 'unsupported', reason: 'range'});
    }
    for (const value of [NaN, Infinity, -Infinity])
      expect(injectBasicPlusMa2(value)).toEqual({kind: 'unsupported', reason: 'non-finite'});
  });
  test('canonicalizes both zeros and returns detached frozen values', () => {
    for (const value of [0, -0, 1, -5, 0.1, Infinity, Number.MIN_VALUE]) {
      const result = injectBasicPlusMa2(value);
      expect(Object.isFrozen(result)).toBe(true);
      expect(() => Object.assign(result, {kind: 'changed'})).toThrow(TypeError);
      if (result.kind === 'value') {
        expect(Object.isFrozen(result.words)).toBe(true);
        expect(() => Object.assign(result.words, {0: 1})).toThrow(TypeError);
      }
    }
    expect(injectBasicPlusMa2(-0)).toEqual({kind: 'value', words: [0, 0]});
    const first = injectBasicPlusMa2(1),
      second = injectBasicPlusMa2(1);
    expect(first).not.toBe(second);
    if (first.kind === 'value' && second.kind === 'value')
      expect(first.words).not.toBe(second.words);
  });
  test('rejects nonprimitive inputs without coercion and isolates repeated calls', () => {
    for (const value of [
      null,
      undefined,
      '1',
      1n,
      true,
      Object(1),
      {
        valueOf() {
          throw new Error('coerced');
        },
      },
    ])
      expect(() => injectBasicPlusMa2(value as number)).toThrow(TypeError);
    expect(injectBasicPlusMa2(-5)).toEqual({kind: 'value', words: [0xc1a0, 0]});
    expect(injectBasicPlusMa2(1)).toEqual({kind: 'value', words: [0x4080, 0]});
  });
});
