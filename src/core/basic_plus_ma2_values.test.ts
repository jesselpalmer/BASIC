import {describe, expect, test} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  basicPlusMa2Unary,
  compareBasicPlusMa2,
  observeBasicPlusMa2,
} from './basic_plus_ma2_values.ts';
import type {BasicPlusMa2UnaryOperation} from './basic_plus_ma2_values.ts';
import reference from './__tests__/ma2-values-reference.json';

const operations = ['absolute', 'negate', 'integer'] as const;
const zero = [0, 0];
const one = [0x4080, 0];

describe('internal canonical selected-MA2 values', () => {
  test.each(reference.unaryRows.map((row, index) => [index, row] as const))(
    'matches original BASIC unary call %i',
    (_index, row) => {
      expect<string[]>([...operations]).toContain(row.operation);
      expect(basicPlusMa2Unary(row.input, row.operation as BasicPlusMa2UnaryOperation)).toEqual({
        kind: 'value',
        words: [row.output[0], row.output[1]],
      });
    },
  );
  test.each(reference.comparisonRows.map((row, index) => [index, row] as const))(
    'matches completed original CMPF call %i',
    (_index, [lh, ll, rh, rl, order, psw, pointer]) => {
      expect([-1, 0, 1]).toContain(order);
      expect(compareBasicPlusMa2([lh, ll], [rh, rl])).toEqual({
        kind: 'value',
        order: order as -1 | 0 | 1,
      });
      expect(pointer).toBe(0o140004);
      expect(psw).toBe(order === 0 ? 4 : order < 0 ? 8 : 0);
    },
  );
  test('pins original sources and every completed observation', () => {
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.simulatorCommit).toBe('698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6');
    expect(reference.unaryRows).toHaveLength(195);
    expect(reference.comparisonRows).toHaveLength(755);
    expect(reference.unaryRunsCompared).toBe(2);
    expect(reference.unaryListingSourceMatch).toBe(true);
    for (const [path, expected] of [
      [reference.unaryProbe, reference.unaryProbeSha256],
      [reference.unaryOutput, reference.unaryOutputSha256],
    ]) {
      expect(
        createHash('sha256')
          .update(readFileSync(new URL('../../' + path, import.meta.url)))
          .digest('hex'),
      ).toBe(expected);
    }
  });
  test('INT preserves float integers beyond a signed word and floors negative fractions', () => {
    for (const words of [
      [0x4c80, 1],
      [0xcc80, 1],
      [0x7fff, 65535],
    ]) {
      expect(basicPlusMa2Unary(words, 'integer')).toEqual({
        kind: 'value',
        words: [words[0], words[1]],
      });
    }
    expect(basicPlusMa2Unary([0xc07f, 65535], 'integer')).toEqual({
      kind: 'value',
      words: [0xc080, 0],
    });
    expect(basicPlusMa2Unary([0xc0ff, 65535], 'integer')).toEqual({
      kind: 'value',
      words: [0xc100, 0],
    });
    expect(basicPlusMa2Unary([0x8080, 1], 'integer')).toEqual({kind: 'value', words: [0xc080, 0]});
  });
  test('observations preserve every significand bit throughout the MA2 exponent range', () => {
    const bits = new DataView(new ArrayBuffer(8));
    for (let exponent = 1; exponent <= 255; exponent++) {
      for (const fraction of [0, 1, 0x7fffff]) {
        for (const negative of [false, true]) {
          const result = observeBasicPlusMa2([
            (negative ? 32768 : 0) + exponent * 128 + (fraction >>> 16),
            fraction & 65535,
          ]);
          expect(result.kind).toBe('value');
          if (result.kind !== 'value') throw new Error('Expected observation');
          bits.setFloat64(0, result.value);
          const encoded = bits.getBigUint64(0);
          expect(encoded >> 63n).toBe(negative ? 1n : 0n);
          expect(Number((encoded >> 52n) & 2047n) - 1023 - 52).toBe(exponent - 152 - 29);
          expect((encoded & ((1n << 52n) - 1n)) | (1n << 52n)).toBe(
            ((1n << 23n) + BigInt(fraction)) << 29n,
          );
        }
      }
    }
    expect(observeBasicPlusMa2(zero)).toEqual({kind: 'value', value: 0});
    const result = observeBasicPlusMa2(zero);
    if (result.kind === 'value') expect(Object.is(result.value, -0)).toBe(false);
  });
  test.each([
    [[0x8000, 0], 'signed-zero'],
    [[0, 1], 'zero-exponent-fraction'],
    [[0x4080, 0, 0, 1], 'four-word-precision'],
    [[0, 0, 0, 0], 'four-word-precision'],
  ] as const)('keeps unsupported words explicit: %j', (words, reason) => {
    for (const op of operations) {
      const result = basicPlusMa2Unary(words, op);
      expect(result).toEqual({kind: 'unsupported', reason});
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(observeBasicPlusMa2(words)).toEqual({kind: 'unsupported', reason});
    expect(compareBasicPlusMa2(words, one)).toEqual({kind: 'unsupported', operand: 'left', reason});
    expect(compareBasicPlusMa2(one, words)).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason,
    });
  });
  test('validates operation before any operand access and left before right', () => {
    const unreadable = new Proxy([], {
      get() {
        throw new Error('accessed');
      },
    });
    expect(() => basicPlusMa2Unary(unreadable, 'unknown' as BasicPlusMa2UnaryOperation)).toThrow(
      'Unsupported MA2 unary operation',
    );
    expect(compareBasicPlusMa2([0x8000, 0], unreadable)).toEqual({
      kind: 'unsupported',
      operand: 'left',
      reason: 'signed-zero',
    });
    expect(() => compareBasicPlusMa2([1], unreadable)).toThrow('exactly two or four');
  });
  test('inherits strict container and word validation for every entry point', () => {
    for (const words of [
      null,
      {},
      new Uint16Array(2),
      [],
      [0],
      [0, 0, 0],
      [0, NaN],
      [-1, 0],
      [0, 65536],
      [0, 0.5],
      [0, '1'],
    ]) {
      for (const call of [
        () => basicPlusMa2Unary(words as number[], 'integer'),
        () => observeBasicPlusMa2(words as number[]),
        () => compareBasicPlusMa2(words as number[], zero),
        () => compareBasicPlusMa2(zero, words as number[]),
      ]) {
        expect(call).toThrow();
      }
    }
  });
  test('reads each word once without iteration and returns detached frozen values', () => {
    for (const call of [
      (words: number[]) => basicPlusMa2Unary(words, 'absolute'),
      observeBasicPlusMa2,
      (words: number[]) => compareBasicPlusMa2(words, one),
    ]) {
      const reads = [0, 0];
      const words = [0xc0c0, 0];
      for (let index = 0; index < 2; index++) {
        const value = words[index];
        Object.defineProperty(words, index, {
          get() {
            reads[index]++;
            return value;
          },
        });
      }
      Object.defineProperty(words, Symbol.iterator, {
        get() {
          throw new Error('iterated');
        },
      });
      const result = call(words);
      expect(reads).toEqual([1, 1]);
      expect(Object.isFrozen(result)).toBe(true);
    }
    const words = [0xc0c0, 1];
    const result = basicPlusMa2Unary(words, 'absolute');
    words[0] = 0;
    if (result.kind !== 'value') throw new Error('Expected value');
    expect(result.words).toEqual([0x40c0, 1]);
    expect(Object.isFrozen(result.words)).toBe(true);
    expect(() => Object.assign(result.words, {0: 0})).toThrow(TypeError);
    expect(() => Object.assign(result, {kind: 'changed'})).toThrow(TypeError);
  });
});
