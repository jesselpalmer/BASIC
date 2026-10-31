import {describe, expect, test} from 'bun:test';
import {
  decodeBasicPlusFloatingWords,
  type BasicPlusFloatingValue,
  type BasicPlusFloatingWordResult,
} from './basic_plus_floating_words.ts';

function value(result: BasicPlusFloatingWordResult): BasicPlusFloatingValue {
  expect(result.kind).toBe('value');
  if (result.kind !== 'value') throw new Error(`Unexpected unsupported encoding: ${result.reason}`);
  return result.value;
}

function exactInteger(result: BasicPlusFloatingWordResult): bigint {
  const decoded = value(result);
  const signed = BigInt(decoded.sign) * decoded.significand;
  if (decoded.binaryExponent >= 0) return signed << BigInt(decoded.binaryExponent);
  const denominator = 1n << BigInt(-decoded.binaryExponent);
  expect(signed % denominator).toBe(0n);
  return signed / denominator;
}

describe('internal exact BASIC-PLUS floating-word decoding', () => {
  test('matches visually verified Appendix F-2 octal examples in both formats', () => {
    expect(exactInteger(decodeBasicPlusFloatingWords([0o040200, 0o000000]))).toBe(1n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0o140640, 0o000000]))).toBe(-5n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0o040200, 0, 0, 0]))).toBe(1n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0o140640, 0, 0, 0]))).toBe(-5n);
  });

  test('decodes canonical positive zero without an invented hidden bit', () => {
    for (const [words, precision] of [
      [[0, 0], 24],
      [[0, 0, 0, 0], 56],
    ] as const) {
      const outcome = decodeBasicPlusFloatingWords(words);
      expect(outcome).toEqual({
        kind: 'value',
        value: {precision, sign: 1, significand: 0n, binaryExponent: 0},
      });
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Object.isFrozen(value(outcome))).toBe(true);
    }
  });

  test('keeps signed zero and ambiguous exponent-zero fractions unsupported', () => {
    for (const words of [
      [0x8000, 0],
      [0x8000, 0, 0, 0],
    ]) {
      const outcome = decodeBasicPlusFloatingWords(words);
      expect(outcome).toEqual({kind: 'unsupported', reason: 'signed-zero'});
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(() => Object.assign(outcome, {kind: 'value'})).toThrow(TypeError);
    }
    for (const words of [
      [1, 0],
      [0, 1],
      [0, 0, 1, 0],
      [0x8000, 0, 0, 1],
    ]) {
      const outcome = decodeBasicPlusFloatingWords(words);
      expect(outcome).toEqual({kind: 'unsupported', reason: 'zero-exponent-fraction'});
      expect(Object.isFrozen(outcome)).toBe(true);
    }
  });

  test('decodes every stored exponent and sign independently of fraction bits', () => {
    for (let exponent = 1; exponent <= 255; exponent += 1) {
      for (const sign of [1, -1] as const) {
        for (const [length, precision] of [
          [2, 24],
          [4, 56],
        ] as const) {
          const words = Array<number>(length).fill(0);
          words[0] = exponent * 128 + (sign === -1 ? 32768 : 0);
          expect(value(decodeBasicPlusFloatingWords(words))).toEqual({
            precision,
            sign,
            significand: 2n ** BigInt(precision - 1),
            binaryExponent: exponent - 128 - precision,
          });
        }
      }
    }
  });

  test('retains each fraction bit in address order with its documented significance', () => {
    for (const [length, precision] of [
      [2, 24],
      [4, 56],
    ] as const) {
      for (let fractionBit = 0; fractionBit < precision - 1; fractionBit += 1) {
        const words = Array<number>(length).fill(0);
        words[0] = 0o040200;
        const index = length - 1 - Math.floor(fractionBit / 16);
        words[index] += 2 ** (fractionBit % 16);
        expect(value(decodeBasicPlusFloatingWords(words))).toEqual({
          precision,
          sign: 1,
          significand: 2n ** BigInt(precision - 1) + 2n ** BigInt(fractionBit),
          binaryExponent: 1 - precision,
        });
      }
    }
    expect(value(decodeBasicPlusFloatingWords([0x4081, 0x2345, 0x6789, 0xabcd])).significand).toBe(
      0x8123456789abcdn,
    );
  });

  test('preserves integer units beyond binary64 precision and all 56 significant bits', () => {
    expect(exactInteger(decodeBasicPlusFloatingWords([0x4c80, 0x0001]))).toBe(2n ** 24n + 2n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0x4c80, 0, 0x8000, 0]))).toBe(2n ** 24n + 1n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0x5b00, 0, 0, 4]))).toBe(2n ** 53n + 1n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0x5c00, 0, 0, 1]))).toBe(2n ** 55n + 1n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0x5c00, 0, 0, 2]))).toBe(2n ** 55n + 2n);
    expect(exactInteger(decodeBasicPlusFloatingWords([0x5c80, 0, 0, 0]))).toBe(2n ** 56n);
  });

  test('describes normalized endpoint patterns exactly without asserting runtime range policy', () => {
    expect(value(decodeBasicPlusFloatingWords([0x0080, 0]))).toEqual({
      precision: 24,
      sign: 1,
      significand: 2n ** 23n,
      binaryExponent: -151,
    });
    expect(value(decodeBasicPlusFloatingWords([0x0080, 0, 0, 0]))).toEqual({
      precision: 56,
      sign: 1,
      significand: 2n ** 55n,
      binaryExponent: -183,
    });
    expect(value(decodeBasicPlusFloatingWords([0xffff, 0xffff]))).toEqual({
      precision: 24,
      sign: -1,
      significand: 2n ** 24n - 1n,
      binaryExponent: 103,
    });
    expect(value(decodeBasicPlusFloatingWords([0xffff, 0xffff, 0xffff, 0xffff]))).toEqual({
      precision: 56,
      sign: -1,
      significand: 2n ** 56n - 1n,
      binaryExponent: 71,
    });
  });

  test.each([undefined, null, 1, '040200 000000', {}, {length: 2, 0: 0, 1: 0}, new Uint16Array(2)])(
    'rejects non-array containers without coercion: %p',
    (input) => {
      expect(() => decodeBasicPlusFloatingWords(input as unknown as readonly number[])).toThrow(
        TypeError,
      );
    },
  );

  test.each([0, 1, 3, 5, 1000000])(
    'rejects unsupported length %p before reading payload',
    (length) => {
      const words = Array<number>(length);
      if (length !== 0) {
        Object.defineProperty(words, '0', {
          get: () => {
            throw new Error('payload touched');
          },
        });
      }
      expect(() => decodeBasicPlusFloatingWords(words)).toThrow('exactly two or four words');
    },
  );

  test.each([NaN, Infinity, -Infinity, -1, 65536, 0.5, '0', 0n, null, undefined, {}])(
    'rejects malformed words without truncation or coercion: %p',
    (word) => {
      for (const position of [0, 1, 2, 3]) {
        const words: unknown[] = [0o040200, 0, 0, 0];
        words[position] = word;
        expect(() => decodeBasicPlusFloatingWords(words as readonly number[])).toThrow(
          'integer in 0..65535',
        );
      }
    },
  );

  test('validates every word even for unsupported encodings and rejects sparse arrays', () => {
    expect(() => decodeBasicPlusFloatingWords([0x8000, -1])).toThrow(RangeError);
    expect(() => decodeBasicPlusFloatingWords(Array<number>(2))).toThrow(RangeError);
    const words = [0, 0];
    Object.defineProperty(words, '1', {
      get: () => {
        throw new Error('word read failed');
      },
    });
    expect(() => decodeBasicPlusFloatingWords(words)).toThrow('word read failed');
  });

  test('ignores caller iterators and snapshots each length/index once within four reads', () => {
    const words = [0o040200, 0, 0, 0];
    Object.defineProperty(words, Symbol.iterator, {
      get: () => {
        throw new Error('iterator touched');
      },
    });
    const reads: PropertyKey[] = [];
    const guarded = new Proxy(words, {
      get(target, key) {
        reads.push(key);
        if (key === 'length')
          return reads.filter((read) => read === key).length === 1 ? 4 : 1000000;
        const index = Number(key);
        const word = target[index];
        target[index] = 65535;
        return word;
      },
    });
    const decoded = value(decodeBasicPlusFloatingWords(guarded));
    expect(decoded.significand).toBe(2n ** 55n);
    expect(reads).toEqual(['length', '0', '1', '2', '3']);
    words.fill(0);
    expect(decoded.significand).toBe(2n ** 55n);
  });

  test('rejects excessive proxy lengths without accessing an index or iterator', () => {
    const words = new Proxy([0, 0], {
      get(_target, key) {
        if (key === 'length') return Number.MAX_SAFE_INTEGER;
        throw new Error('payload touched');
      },
    });
    expect(() => decodeBasicPlusFloatingWords(words)).toThrow('exactly two or four words');
  });

  test('freezes nonzero results and descriptors without retaining the input', () => {
    const words = [0o040200, 0];
    const outcome = decodeBasicPlusFloatingWords(words);
    const decoded = value(outcome);
    words[0] = 0;
    expect(decoded.significand).toBe(8388608n);
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(() => Object.assign(outcome, {kind: 'unsupported'})).toThrow(TypeError);
    expect(() => Object.assign(decoded, {significand: 0n})).toThrow(TypeError);
  });
});
