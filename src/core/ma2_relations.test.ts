import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {compareMa2Relation, compareValues} from './comparison.ts';
import {bindMa2Words, type Ma2Value} from './ma2_value.ts';
import type {Comparison, ComparisonOperator} from './types.ts';
import reference from './__tests__/ma2-values-reference.json';

const operators = ['=', '<>', '<', '<=', '>', '>='] as const;
// Independent relational truth tables for the machine-observed order flags.
const truth: Record<-1 | 0 | 1, readonly boolean[]> = {
  [-1]: [false, true, true, true, false, false],
  0: [true, false, false, true, false, true],
  1: [false, true, false, false, true, true],
};
function bound(words: readonly number[]): Ma2Value {
  const result = bindMa2Words(words);
  if (result.kind !== 'value') throw new Error('Expected canonical input');
  return result.value;
}
const forged = (words: readonly number[]) => ({kind: 'ma2', words}) as Ma2Value;
function condition(operator: ComparisonOperator): Comparison {
  const node = api.parseProgram('10 IF 1=2 THEN 20\n20 END').lines[0].statement;
  if (node.type !== 'IfStatement') throw new Error('Expected IF');
  return {...node.condition, operator};
}

describe('MA2 numeric relations through the shared comparison owner', () => {
  test.each(reference.comparisonRows.map((row, i) => [i, row] as const))(
    'matches all six relations for retained CMPF call %i',
    (_i, [lh, ll, rh, rl, order]) => {
      if (order !== -1 && order !== 0 && order !== 1) throw new Error('Invalid captured order');
      for (let i = 0; i < operators.length; i++)
        expect(compareMa2Relation(bound([lh, ll]), operators[i], bound([rh, rl]))).toEqual({
          kind: 'value',
          value: truth[order][i],
        });
    },
  );
  test('checks the closed operator before reading hostile operands and retains strict domains', () => {
    const unreadable = new Proxy({} as Ma2Value, {
      get() {
        throw new Error('operand read');
      },
    });
    expect(() => compareMa2Relation(unreadable, '==' as ComparisonOperator, unreadable)).toThrow(
      RangeError,
    );
    const one = bound([0x4080, 0]);
    for (const [words, reason] of [
      [[0x8000, 0], 'signed-zero'],
      [[0, 1], 'zero-exponent-fraction'],
      [[0x4080, 0, 0, 0], 'four-word-precision'],
    ] as const) {
      expect(compareMa2Relation(forged(words), '=', one)).toEqual({
        kind: 'unsupported',
        operand: 'left',
        reason,
      });
      expect(compareMa2Relation(one, '=', forged(words))).toEqual({
        kind: 'unsupported',
        operand: 'right',
        reason,
      });
    }
    for (const input of [null, 1, '1', {kind: 'native', words: [0x4080, 0]}])
      expect(() => compareMa2Relation(input as unknown as Ma2Value, '=', one)).toThrow(TypeError);
    expect(() => compareMa2Relation(forged([65536, 0]), '=', one)).toThrow(RangeError);
    expect(() => compareMa2Relation(forged([1]), '=', one)).toThrow(RangeError);
  });
  test('returns frozen detached predicates for zeros, signs, adjacent values and extrema', () => {
    const zero = bound([0, 0]),
      one = bound([0x4080, 0]),
      neighbor = bound([0x4080, 1]),
      negative = bound([0xc080, 0]),
      maximum = bound([0x7fff, 65535]);
    for (const [left, operator, right, value] of [
      [zero, '=', zero, true],
      [negative, '<', zero, true],
      [one, '<', neighbor, true],
      [maximum, '>=', neighbor, true],
    ] as const) {
      const result = compareMa2Relation(left, operator, right);
      expect(result).toEqual({kind: 'value', value});
      expect(Object.isFrozen(result)).toBe(true);
      expect(() => Object.assign(result, {value: !value})).toThrow(TypeError);
    }
    const input = [0x4080, 0],
      value = bound(input),
      result = compareMa2Relation(value, '=', one);
    input.fill(0);
    expect(result).toEqual({kind: 'value', value: true});
  });
  test('preserves native primitive relation behavior, type failures and physical locations', () => {
    for (const [left, right, expected] of [
      [1, 2, truth[-1]],
      [2, 2, truth[0]],
      [3, 2, truth[1]],
      [NaN, 1, [false, true, false, false, false, false]],
      [Infinity, Infinity, truth[0]],
    ] as const)
      for (let i = 0; i < operators.length; i++)
        expect(compareValues(left, right, condition(operators[i]))).toBe(expected[i]);
    expect(compareValues('X', 'X', condition('='))).toBe(true);
    expect(compareValues('X', 'X ', condition('='))).toBe(false);
    expect(compareValues('X', 'Y', condition('<>'))).toBe(true);
    for (const [left, right, operator] of [
      ['A', 'B', '<'],
      [1, '1', '='],
    ] as const) {
      try {
        compareValues(left, right, condition(operator));
        throw new Error('Expected type error');
      } catch (error) {
        expect(error).toBeInstanceOf(api.BasicRuntimeError);
        if (!(error instanceof api.BasicRuntimeError)) throw error;
        expect(error.diagnostic).toMatchObject({
          code: 'TYPE_MISMATCH',
          label: 10,
          line: 1,
          column: 8,
          offset: 7,
        });
      }
    }
    expect(reference.comparisonRows).toHaveLength(755);
    expect('compareMa2Relation' in api).toBe(false);
  });
});
