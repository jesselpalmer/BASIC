import {describe, expect, test} from 'bun:test';
import {basicPlusMa2Arithmetic} from './basic_plus_ma2.ts';
import reference from './__tests__/ma2-division-reference.json';

const one = [0x4080, 0];

describe('internal pinned V4A MA2 division', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'matches original machine result or completed event %i',
    (_index, [lh, ll, rh, rl, outcome, high, low, pointer, mask]) => {
      const actual = basicPlusMa2Arithmetic([lh, ll], 'divide', [rh, rl]);
      expect(pointer).toBe(0o140004);
      if (outcome === 0) {
        expect(mask).toBe(0);
        expect(actual).toEqual({kind: 'value', words: [high, low]});
      } else {
        expect([1, 2, 3]).toContain(outcome);
        expect(mask).toBe(outcome === 3 ? 0o100006 : 0o100002);
        expect(actual).toEqual(
          outcome === 3
            ? {
                kind: 'numeric-event',
                code: 61,
                reason: 'division-by-zero',
                continuationWords: [high, low],
              }
            : {
                kind: 'numeric-event',
                code: 48,
                reason: outcome === 1 ? 'overflow' : 'underflow',
                continuationWords: [high, low],
              },
        );
      }
    },
  );

  test('retains every pinned result, mask and bounded original-handler capture', () => {
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.simulatorCommit).toBe('698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6');
    expect(reference.calls).toBe(1325);
    expect(reference.rows).toHaveLength(reference.calls);
    expect(reference.counts).toEqual({'0': 1059, '1': 148, '2': 113, '3': 5});
    expect([0, 1, 2, 3].map((kind) => reference.rows.filter((r) => r[4] === kind).length)).toEqual([
      1059, 148, 113, 5,
    ]);
    expect(reference.continuedEventCalls).toBe(266);
    expect(reference.maxEventHistoryEntries).toBe(352);
    expect(reference.maxEventHistoryEntries).toBeLessThan(reference.eventHistoryCapacity);
    expect(reference.inlineMasksOctal).toEqual({range: '100002', divisionByZero: '100006'});
  });

  test('agrees with booted BASIC recurring quotient and power-of-two calibrations', () => {
    expect(basicPlusMa2Arithmetic(one, 'divide', [0x4140, 0])).toEqual({
      kind: 'value',
      words: [0x3faa, 0xaaab],
    });
    expect(basicPlusMa2Arithmetic(one, 'divide', [0x4c80, 0])).toEqual({
      kind: 'value',
      words: [0x3480, 0],
    });
  });

  test('distinguishes zero dividend, zero divisor and 0/0 after full operand validation', () => {
    expect(basicPlusMa2Arithmetic([0, 0], 'divide', one)).toEqual({
      kind: 'value',
      words: [0, 0],
    });
    for (const dividend of [one, [0, 0]]) {
      expect(basicPlusMa2Arithmetic(dividend, 'divide', [0, 0])).toEqual({
        kind: 'numeric-event',
        code: 61,
        reason: 'division-by-zero',
        continuationWords: [0, 0],
      });
    }
    expect(() => basicPlusMa2Arithmetic([0, 0], 'divide', [65536, 0])).toThrow(RangeError);
    expect(basicPlusMa2Arithmetic([0, 0], 'divide', [0x8000, 0])).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason: 'signed-zero',
    });
    expect(basicPlusMa2Arithmetic(one, 'divide', [0, 1])).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason: 'zero-exponent-fraction',
    });
    expect(basicPlusMa2Arithmetic([0x4080, 0, 0, 0], 'divide', [0, 0])).toEqual({
      kind: 'unsupported',
      operand: 'left',
      reason: 'four-word-precision',
    });
  });

  test.each([
    [one, [0x4140, 0]],
    [
      [0x0080, 0],
      [0x7fff, 0xffff],
    ],
    [
      [0x7fff, 0xffff],
      [0x0080, 0],
    ],
    [one, [0, 0]],
    [[0, 0], one],
  ])('detaches and freezes normal, zero and event words for %j divided by %j', (left, right) => {
    const l = [...left];
    const r = [...right];
    const actual = basicPlusMa2Arithmetic(l, 'divide', r);
    const snapshot = structuredClone(actual);
    l.fill(0);
    r.fill(0);
    expect(actual).toEqual(snapshot);
    expect(Object.isFrozen(actual)).toBe(true);
    if (actual.kind === 'unsupported') throw new Error('Expected supported division');
    const words = actual.kind === 'value' ? actual.words : actual.continuationWords;
    expect(Object.isFrozen(words)).toBe(true);
    expect(() => Object.assign(words, {0: 1})).toThrow(TypeError);
  });
});
