import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {truncateMa2ToWord} from './ma2_word_conversion.ts';
import {basicPlusMa2DecimalLiteral} from './basic_plus_ma2_decimal.ts';
import {basicPlusMa2Unary} from './basic_plus_ma2_values.ts';
import {injectBasicPlusMa2} from './basic_plus_ma2_injection.ts';
import observations from '../../docs/first-game-runtime-observations.json';

function sourceWords(source: string): readonly [number, number] {
  const negative = source.startsWith('-');
  const value = basicPlusMa2DecimalLiteral(negative ? source.slice(1) : source);
  if (value.kind !== 'value') throw new Error('Expected retained source value');
  if (!negative) return value.words;
  const negated = basicPlusMa2Unary(value.words, 'negate');
  if (negated.kind !== 'value') throw new Error('Expected canonical negation');
  return negated.words;
}
function hostWords(value: number): readonly [number, number] {
  const result = injectBasicPlusMa2(value);
  if (result.kind !== 'value') throw new Error('Expected exact test value');
  return result.words;
}

describe('exact mathematical MA2 to signed-word conversion', () => {
  test.each(observations.subscripts.map((row) => [row.id, row] as const))(
    'separates retained subscript observation %i from conversion and bounds facts',
    (_id, row) => {
      const converted = truncateMa2ToWord(sourceWords(row.sourceSpelling));
      if (row.kind === 'value') {
        expect(converted).toEqual({kind: 'value', value: row.value! / 10 - 1});
      } else if (row.ERR === 51) {
        expect(converted).toEqual({kind: 'unsupported', reason: 'signed-word-range'});
      } else {
        expect(row.ERR).toBe(55);
        const integer = Math.trunc(Number(row.sourceSpelling));
        expect(converted).toEqual({kind: 'value', value: integer});
        expect(integer < 0 || integer > 3).toBe(true);
      }
    },
  );
  test('matches independent integer-rational quotients over every exponent and both signs', () => {
    for (let exponent = 1; exponent <= 255; exponent++)
      for (const fraction of [0, 1, 0x3fffff, 0x7ffffe, 0x7fffff])
        for (const sign of [1, -1]) {
          const words = [
            (sign < 0 ? 32768 : 0) + exponent * 128 + Math.floor(fraction / 65536),
            fraction % 65536,
          ];
          let numerator = BigInt(sign) * BigInt(8388608 + fraction),
            denominator = 1n;
          if (exponent >= 152) numerator *= 2n ** BigInt(exponent - 152);
          else denominator = 2n ** BigInt(152 - exponent);
          const quotient = numerator / denominator;
          const expected =
            quotient < -32768n || quotient > 32767n
              ? {kind: 'unsupported' as const, reason: 'signed-word-range' as const}
              : {kind: 'value' as const, value: Number(quotient)};
          expect(truncateMa2ToWord(words)).toEqual(expected);
        }
  });
  test('truncates fractional signed endpoints mathematically without inferring BASIC behavior', () => {
    for (const [input, expected] of [
      [0, 0],
      [-0, 0],
      [0.5, 0],
      [-0.5, 0],
      [1.5, 1],
      [-1.5, -1],
      [32767.5, 32767],
      [-32768.5, -32768],
    ] as const)
      expect(truncateMa2ToWord(hostWords(input))).toEqual({kind: 'value', value: expected});
    for (const input of [32768, -32769, 32768.5, -32769.5, 2 ** 100, -(2 ** 100)])
      expect(truncateMa2ToWord(hostWords(input))).toEqual({
        kind: 'unsupported',
        reason: 'signed-word-range',
      });
    const zero = truncateMa2ToWord([-0, -0]);
    expect(zero).toEqual({kind: 'value', value: 0});
    if (zero.kind !== 'value') throw new Error('Missing zero');
    expect(Object.is(zero.value, 0)).toBe(true);
  });
  test('retains strict decoder boundaries, one-read snapshots and immutable detached outcomes', () => {
    for (const input of [null, undefined, 1, '1', {}, new Uint16Array(2)])
      expect(() => truncateMa2ToWord(input as readonly number[])).toThrow(TypeError);
    for (const input of [
      [],
      [1],
      [1, 2, 3],
      [-1, 0],
      [65536, 0],
      [NaN, 0],
      [0, Infinity],
      [0, '0'],
      [0, 0.5],
    ])
      expect(() => truncateMa2ToWord(input as number[])).toThrow(RangeError);
    expect(truncateMa2ToWord([0x8000, 0])).toEqual({kind: 'unsupported', reason: 'signed-zero'});
    expect(truncateMa2ToWord([0, 1])).toEqual({
      kind: 'unsupported',
      reason: 'zero-exponent-fraction',
    });
    expect(truncateMa2ToWord([0x4080, 0, 0, 0])).toEqual({
      kind: 'unsupported',
      reason: 'four-word-precision',
    });
    const reads = [0, 0],
      words = [0x4080, 1];
    for (let i = 0; i < 2; i++) {
      const value = words[i];
      Object.defineProperty(words, i, {
        get() {
          reads[i]++;
          return value;
        },
      });
    }
    Object.defineProperty(words, Symbol.iterator, {
      get() {
        throw new Error('iterator read');
      },
    });
    expect(truncateMa2ToWord(words)).toEqual({kind: 'value', value: 1});
    expect(reads).toEqual([1, 1]);
    const unreadable = new Proxy([], {
      get(_target, key) {
        if (key === 'length') return 1000000;
        throw new Error('payload read');
      },
    });
    expect(() => truncateMa2ToWord(unreadable)).toThrow(RangeError);
    const mutable = [0x4080, 0],
      result = truncateMa2ToWord(mutable);
    mutable.fill(0);
    expect(result).toEqual({kind: 'value', value: 1});
    for (const object of [result, truncateMa2ToWord([0x7fff, 65535])]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
    }
  });
  test('does not expose conversion or change native fractional array rejection', () => {
    expect(observations.subscripts).toHaveLength(32);
    expect('truncateMa2ToWord' in api).toBe(false);
    const basic = new api.Basic();
    expect(() => basic.run('10 DIM A(3)\n20 A(.5)=1')).toThrow(api.BasicRuntimeError);
    expect(() => api.parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
  });
});
