import {describe, expect, test} from 'bun:test';
import {basicPlusMa2Arithmetic} from './basic_plus_ma2.ts';
import reference from './__tests__/ma2-range-reference.json';

describe('selected MA2 range continuation', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'matches completed original-monitor call %i',
    (_index, [lh, ll, operation, rh, rl, condition, high, low, mask, traps]) => {
      const result = basicPlusMa2Arithmetic([lh, ll], operation === 0 ? 'add' : 'subtract', [
        rh,
        rl,
      ]);
      if (condition === 0) {
        expect([mask, traps]).toEqual([0, 0]);
        expect(result).toEqual({kind: 'value', words: [high, low]});
      } else {
        expect(mask).toBe(0o100002);
        expect([1, 2]).toContain(traps);
        expect(result).toEqual({
          kind: 'numeric-event',
          code: 48,
          reason: condition === 1 ? 'overflow' : 'underflow',
          continuationWords: [high, low],
        });
      }
    },
  );

  test('records real-handler coverage and bounded complete instruction histories', () => {
    expect(reference.normalReferenceCasesChecked).toBe(480);
    expect(reference.calls).toBe(598);
    expect(reference.rows).toHaveLength(118);
    expect(reference.counts).toEqual({'0': 495, '1': 78, '2': 25});
    expect(reference.machineTrapCounts).toEqual({'0': 495, '1': 95, '2': 8});
    expect(reference.maxObservedHistoryEntries).toBe(210);
    expect(reference.maxObservedHistoryEntries).toBeLessThan(reference.historyEntriesPerCase);
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.inlineMasks).toEqual({overflow: '100002', underflow: '100002'});
  });

  test('distinguishes carry overflow, rounding overflow and normalized underflow', () => {
    const maximum = [0x7fff, 0xffff];
    expect(basicPlusMa2Arithmetic(maximum, 'add', maximum)).toEqual({
      kind: 'numeric-event',
      code: 48,
      reason: 'overflow',
      continuationWords: [0xff, 0xffff],
    });
    expect(basicPlusMa2Arithmetic(maximum, 'add', [0x7380, 0])).toEqual({
      kind: 'numeric-event',
      code: 48,
      reason: 'overflow',
      continuationWords: [0, 0],
    });
    expect(basicPlusMa2Arithmetic([0x80, 1], 'subtract', [0x80, 0])).toEqual({
      kind: 'numeric-event',
      code: 48,
      reason: 'underflow',
      continuationWords: [0, 0],
    });
  });

  test('keeps completion words detached and frozen without promoting the event to a value', () => {
    const input = [0x7fff, 0xffff];
    const result = basicPlusMa2Arithmetic(input, 'add', input);
    input.fill(0);
    expect(result.kind).toBe('numeric-event');
    expect(result).not.toHaveProperty('words');
    expect(result).not.toHaveProperty('mask');
    expect(result).not.toHaveProperty('machineTraps');
    if (result.kind !== 'numeric-event') throw new Error('Expected range event');
    expect(result.continuationWords).toEqual([0xff, 0xffff]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.continuationWords)).toBe(true);
    expect(() => Object.assign(result.continuationWords, {0: 0})).toThrow(TypeError);
    expect(() => Object.assign(result, {kind: 'value'})).toThrow(TypeError);
  });
});
