import {describe, expect, test} from 'bun:test';
import {basicPlusMa2Arithmetic} from './basic_plus_ma2.ts';
import reference from './__tests__/ma2-multiplication-reference.json';

const one = [0x4080, 0];

describe('internal pinned V4A MA2 multiplication', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'matches original machine result or completed range event %i',
    (_index, [lh, ll, rh, rl, outcome, high, low, pointer, mask]) => {
      const actual = basicPlusMa2Arithmetic([lh, ll], 'multiply', [rh, rl]);
      if (outcome === 0) {
        expect([pointer, mask]).toEqual([0o140004, 0]);
        expect(actual).toEqual({kind: 'value', words: [high, low]});
      } else {
        expect([1, 2]).toContain(outcome);
        expect([pointer, mask]).toEqual([0o140006, 0o100002]);
        expect(actual).toEqual({
          kind: 'numeric-event',
          code: 48,
          reason: outcome === 1 ? 'overflow' : 'underflow',
          continuationWords: [high, low],
        });
      }
    },
  );

  test('retains pinned identities and every bounded independent capture', () => {
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.simulatorCommit).toBe('698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6');
    expect(reference.calls).toBe(1341);
    expect(reference.rows).toHaveLength(reference.calls);
    expect(reference.counts).toEqual({'0': 1087, '1': 144, '2': 110});
    expect([0, 1, 2].map((kind) => reference.rows.filter((r) => r[4] === kind).length)).toEqual([
      1087, 144, 110,
    ]);
    expect(reference.continuedRangeCalls).toBe(254);
    expect(reference.maxRangeHistoryEntries).toBeGreaterThan(0);
    expect(reference.maxRangeHistoryEntries).toBeLessThan(reference.rangeHistoryCapacity);
    expect(reference.inlineMaskOctal).toBe('100002');
    expect(reference.statusLatchOctal).toBe('140020');
  });

  test('preserves operand order instead of rounding one exact product', () => {
    const left = [16565, 1266];
    const right = [16639, 65533];
    expect(basicPlusMa2Arithmetic(left, 'multiply', right)).toEqual({
      kind: 'value',
      words: [16693, 1264],
    });
    expect(basicPlusMa2Arithmetic(right, 'multiply', left)).toEqual({
      kind: 'value',
      words: [16693, 1263],
    });
  });

  test('matches the booted BASIC multiplication halfway calibration', () => {
    expect(basicPlusMa2Arithmetic([0x4080, 1], 'multiply', [0x40c0, 0])).toEqual({
      kind: 'value',
      words: [0x40c0, 2],
    });
    expect(basicPlusMa2Arithmetic([0xc080, 1], 'multiply', [0x40c0, 0])).toEqual({
      kind: 'value',
      words: [0xc0c0, 2],
    });
  });

  test('validates both operands before zero and preserves unsupported boundaries', () => {
    expect(basicPlusMa2Arithmetic([0, 0], 'multiply', [0x8000, 0])).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason: 'signed-zero',
    });
    expect(() => basicPlusMa2Arithmetic([0, 0], 'multiply', [65536, 0])).toThrow(RangeError);
    expect(basicPlusMa2Arithmetic(one, 'multiply', [0, 1])).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason: 'zero-exponent-fraction',
    });
    expect(basicPlusMa2Arithmetic([0x4080, 0, 0, 0], 'multiply', one)).toEqual({
      kind: 'unsupported',
      operand: 'left',
      reason: 'four-word-precision',
    });
  });

  test.each([
    [
      [0x4080, 1],
      [0x40c0, 0],
    ],
    [
      [0x0080, 0],
      [0x0080, 0],
    ],
    [
      [0x7fff, 0xffff],
      [0x7fff, 0xffff],
    ],
    [[0, 0], one],
  ])('detaches and freezes normal, zero and range words for %j times %j', (left, right) => {
    const l = [...left];
    const r = [...right];
    const result = basicPlusMa2Arithmetic(l, 'multiply', r);
    const snapshot = structuredClone(result);
    l.fill(0);
    r.fill(0);
    expect(result).toEqual(snapshot);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'unsupported') throw new Error('Expected supported multiplication');
    const words = result.kind === 'value' ? result.words : result.continuationWords;
    expect(Object.isFrozen(words)).toBe(true);
    expect(() => Object.assign(words, {0: 42})).toThrow(TypeError);
  });
});
