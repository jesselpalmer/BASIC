import {describe, expect, test} from 'bun:test';
import {basicPlusMa2DecimalLiteral} from './basic_plus_ma2_decimal.ts';
import reference from './__tests__/ma2-decimal-reference.json';

describe('internal selected-MA2 decimal source literals', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'matches original ATOF value or explicit unsupported boundary %i',
    (_index, row) => {
      const [raw, high, low, , psw, mask, consumed, history] = row;
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number' ||
        typeof consumed !== 'number' ||
        typeof history !== 'number'
      ) {
        throw new Error('Invalid ATOF reference row');
      }
      expect(history).toBeLessThan(reference.historyCapacity);
      const actual = basicPlusMa2DecimalLiteral(raw);
      if (mask !== 0) {
        expect(mask).toBe(0o100002);
        expect(actual).toEqual({kind: 'unsupported', reason: 'numeric-event'});
      } else if (psw & 2) {
        expect(actual).toEqual({kind: 'unsupported', reason: 'conversion-status'});
      } else {
        expect(consumed).toBe(raw.length);
        expect(actual).toEqual({kind: 'value', words: [high, low]});
      }
    },
  );

  test('pins every captured call, power-table word and bounded history', () => {
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.simulatorCommit).toBe('698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6');
    expect(reference.calls).toBe(396);
    expect(reference.rows).toHaveLength(reference.calls);
    expect(reference.counts).toEqual({value: 265, 'conversion-status': 114, 'numeric-event': 17});
    expect(reference.maxHistoryEntries).toBe(15107);
    expect(reference.maxHistoryEntries).toBeLessThan(reference.historyCapacity);
    expect(reference.powerTableWords).toEqual([
      0o41040, 0, 0o41710, 0, 0o43434, 0o40000, 0o46676, 0o136040, 0o55416, 0o15712, 0o72635,
      0o142656, 0o37314, 0o146315, 0o36443, 0o153412, 0o34721, 0o133427, 0o31453, 0o146167, 0o22746,
      0o112625, 0o5517, 0o130437,
    ]);
  });

  test('keeps digit cutoff, integer accumulation and scale-status paths distinct', () => {
    for (const raw of ['1.0000001', '1.0000002', '1.00000011920928955078125']) {
      expect(basicPlusMa2DecimalLiteral(raw)).toEqual({kind: 'value', words: [0x4080, 0]});
    }
    expect(basicPlusMa2DecimalLiteral('16777217.')).toEqual({kind: 'value', words: [0x4c80, 1]});
    expect(basicPlusMa2DecimalLiteral('9.999999E-37')).toEqual({
      kind: 'unsupported',
      reason: 'conversion-status',
    });
    expect(basicPlusMa2DecimalLiteral('0E+999')).toEqual({kind: 'value', words: [0, 0]});
    expect(basicPlusMa2DecimalLiteral('.00E-32768')).toEqual({
      kind: 'unsupported',
      reason: 'conversion-status',
    });
    expect(basicPlusMa2DecimalLiteral('9'.repeat(40) + 'E+32768')).toEqual({
      kind: 'unsupported',
      reason: 'numeric-event',
    });
  });

  test.each([
    '',
    '.',
    '-1',
    '+1',
    '1e2',
    '1E',
    '1E+',
    '1E1.2',
    '1 E2',
    '1,2',
    '1%',
    '1\0',
    ' 1',
    '1 ',
    '1\n',
    '1.2.3',
    'Infinity',
    'NaN',
    '١',
  ])('rejects complete-spelling mismatch %j', (raw) => {
    expect(() => basicPlusMa2DecimalLiteral(raw)).toThrow(SyntaxError);
  });

  test('checks primitive strings and bounds before spelling work without coercion', () => {
    for (const raw of [
      null,
      undefined,
      1,
      {},
      Object('1'),
      {
        toString() {
          throw new Error('coerced');
        },
      },
    ]) {
      expect(() => basicPlusMa2DecimalLiteral(raw as unknown as string)).toThrow(TypeError);
    }
    const tooLong = basicPlusMa2DecimalLiteral('0'.repeat(256));
    expect(tooLong).toEqual({kind: 'unsupported', reason: 'input-limit'});
    expect(Object.isFrozen(tooLong)).toBe(true);
    expect(basicPlusMa2DecimalLiteral('0'.repeat(255))).toEqual({kind: 'value', words: [0, 0]});
  });

  test.each(['0', '1', '1.23456789E-5', '1E+39', '9'.repeat(40)])(
    'freezes successful and unsupported results for %j',
    (raw) => {
      const actual = basicPlusMa2DecimalLiteral(raw);
      expect(Object.isFrozen(actual)).toBe(true);
      if (actual.kind === 'value') {
        expect(Object.isFrozen(actual.words)).toBe(true);
        expect(() => Object.assign(actual.words, {0: 42})).toThrow(TypeError);
      }
      expect(() => Object.assign(actual, {kind: 'changed'})).toThrow(TypeError);
    },
  );
});
