import {describe, expect, test} from 'bun:test';
import {
  BASIC_PLUS_WORD_MAXIMUM,
  BASIC_PLUS_WORD_MINIMUM,
  basicPlusWordArithmetic,
  basicPlusWordAssignment,
  basicPlusWordCondition,
  basicPlusWordLogical,
  basicPlusWordNegate,
  basicPlusWordNot,
  basicPlusWordRelation,
  type BasicPlusWordArithmeticOperator,
  type BasicPlusWordLogicalOperator,
  type BasicPlusWordResult,
} from './basic_plus_words.ts';

function value(outcome: BasicPlusWordResult): number {
  expect(outcome.kind).toBe('value');
  if (outcome.kind !== 'value') throw new Error(`Unexpected unsupported result: ${outcome.reason}`);
  return outcome.value;
}

function referenceWord(value: number): number {
  const normalized = ((value % 65536) + 65536) % 65536;
  return normalized >= 32768 ? normalized - 65536 : normalized;
}

function referenceLogical(
  left: number,
  operator: BasicPlusWordLogicalOperator,
  right: number,
): number {
  const leftPattern = left < 0 ? left + 65536 : left;
  const rightPattern = right < 0 ? right + 65536 : right;
  const expectedBits = Array.from({length: 16}, (_, index) => {
    const leftSet = Math.floor(leftPattern / 2 ** index) % 2 === 1;
    const rightSet = Math.floor(rightPattern / 2 ** index) % 2 === 1;
    switch (operator) {
      case 'and':
        return leftSet && rightSet;
      case 'or':
        return leftSet || rightSet;
      case 'xor':
        return leftSet !== rightSet;
      case 'imp':
        return !leftSet || rightSet;
      case 'eqv':
        return leftSet === rightSet;
    }
  });
  const pattern = expectedBits.reduce((sum, set, index) => sum + (set ? 2 ** index : 0), 0);
  return pattern >= 32768 ? pattern - 65536 : pattern;
}

describe('internal BASIC-PLUS signed-word conformance', () => {
  test('defines the complete two-complement word range', () => {
    expect(BASIC_PLUS_WORD_MINIMUM).toBe(-32768);
    expect(BASIC_PLUS_WORD_MAXIMUM).toBe(32767);
  });

  test.each([NaN, Infinity, -Infinity])('rejects nonfinite assignment input: %p', (input) => {
    expect(() => basicPlusWordAssignment(input)).toThrow(
      'BASIC-PLUS assignment input must be finite',
    );
  });

  test.each([
    [1.9, 1],
    [-1.9, -1],
    [-0.9, 0],
    [32767.9, 32767],
    [-32768.9, -32768],
  ])('truncates assignment %p toward zero as %p', (input, expected) => {
    const outcome = basicPlusWordAssignment(input);
    expect(outcome).toEqual({kind: 'value', value: expected});
    expect(Object.isFrozen(outcome)).toBe(true);
    if (expected === 0 && outcome.kind === 'value')
      expect(Object.is(outcome.value, -0)).toBe(false);
  });

  test.each([32768, -32769, 1e100, -1e100])(
    'keeps assignment boundary continuation explicit: %p',
    (input) => {
      const outcome = basicPlusWordAssignment(input);
      expect(outcome).toEqual({kind: 'unsupported', reason: 'assignment-boundary'});
      expect(Object.isFrozen(outcome)).toBe(true);
    },
  );

  test('cycles arithmetic across both endpoints', () => {
    expect(value(basicPlusWordArithmetic(32767, 'add', 2))).toBe(-32767);
    expect(value(basicPlusWordArithmetic(-32768, 'subtract', 1))).toBe(32767);
    expect(value(basicPlusWordArithmetic(300, 'multiply', 300))).toBe(24464);
    expect(value(basicPlusWordArithmetic(-32768, 'multiply', -32768))).toBe(0);
  });

  test('matches an independent residue oracle across representative word products and sums', () => {
    const words = [-32768, -32767, -300, -1, 0, 1, 300, 32766, 32767];
    for (const left of words) {
      for (const right of words) {
        expect(value(basicPlusWordArithmetic(left, 'add', right))).toBe(
          referenceWord(left + right),
        );
        expect(value(basicPlusWordArithmetic(left, 'subtract', right))).toBe(
          referenceWord(left - right),
        );
        expect(value(basicPlusWordArithmetic(left, 'multiply', right))).toBe(
          referenceWord(left * right),
        );
      }
    }
  });

  test.each([
    [199, 100, 1],
    [-199, 100, -1],
    [199, -100, -1],
    [-199, -100, 1],
    [2, 4, 0],
  ])('truncates word division %p / %p as %p', (left, right, expected) => {
    expect(value(basicPlusWordArithmetic(left, 'divide', right))).toBe(expected);
  });

  test('reports unresolved division boundaries instead of inventing continuation values', () => {
    expect(basicPlusWordArithmetic(1, 'divide', 0)).toEqual({
      kind: 'unsupported',
      reason: 'division-by-zero',
    });
    expect(basicPlusWordArithmetic(-32768, 'divide', -1)).toEqual({
      kind: 'unsupported',
      reason: 'division-overflow',
    });
  });

  test('negates every supported word exactly and keeps minimum negation unresolved', () => {
    expect(basicPlusWordNegate(-32768)).toEqual({
      kind: 'unsupported',
      reason: 'minimum-word-negation',
    });
    for (let word = -32767; word <= 32767; word += 1) {
      expect(value(basicPlusWordNegate(word))).toBe(-word);
    }
  });

  test('complements every word and cycles the endpoints', () => {
    for (let word = -32768; word <= 32767; word += 1) {
      expect(value(basicPlusWordNot(word))).toBe(-word - 1);
    }
  });

  test.each([
    ['and', 2],
    ['or', 7],
    ['xor', 5],
    ['imp', -5],
    ['eqv', -6],
  ] as const)('computes 6 %s 3 as %p', (operator, expected) => {
    expect(value(basicPlusWordLogical(6, operator, 3))).toBe(expected);
  });

  test('matches independent bit truth tables across signed patterns and every bit', () => {
    const operators: BasicPlusWordLogicalOperator[] = ['and', 'or', 'xor', 'imp', 'eqv'];
    const patterns = [-32768, -21846, -1, 0, 1, 3, 6, 21845, 32767];
    for (const bit of Array.from({length: 16}, (_, index) => referenceWord(2 ** index))) {
      patterns.push(bit);
    }
    for (const operator of operators) {
      for (const left of patterns) {
        for (const right of patterns) {
          expect(value(basicPlusWordLogical(left, operator, right))).toBe(
            referenceLogical(left, operator, right),
          );
        }
      }
    }
  });

  test('uses -1 and zero for relations and zero/nonzero for conditions', () => {
    expect(basicPlusWordRelation(true)).toBe(-1);
    expect(basicPlusWordRelation(false)).toBe(0);
    expect(basicPlusWordCondition(0)).toBe(false);
    expect(basicPlusWordCondition(-1)).toBe(true);
    expect(basicPlusWordCondition(32767)).toBe(true);
    expect(basicPlusWordCondition(value(basicPlusWordLogical(4, 'and', 2)))).toBe(false);
  });

  test.each([NaN, Infinity, -Infinity, 1.5, -32769, 32768])(
    'rejects malformed word operands at every pure boundary: %p',
    (operand) => {
      const error = 'BASIC-PLUS word operand must be an integer in -32768..32767';
      expect(() => basicPlusWordArithmetic(operand, 'add', 0)).toThrow(error);
      expect(() => basicPlusWordArithmetic(0, 'add', operand)).toThrow(error);
      expect(() => basicPlusWordNegate(operand)).toThrow(error);
      expect(() => basicPlusWordNot(operand)).toThrow(error);
      expect(() => basicPlusWordLogical(operand, 'and', 0)).toThrow(error);
      expect(() => basicPlusWordLogical(0, 'and', operand)).toThrow(error);
      expect(() => basicPlusWordCondition(operand)).toThrow(error);
    },
  );

  test('rejects constructed unsupported operators and non-Boolean relations', () => {
    expect(() => basicPlusWordArithmetic(0, 'power' as BasicPlusWordArithmeticOperator, 0)).toThrow(
      'Unsupported BASIC-PLUS word arithmetic operator',
    );
    expect(() => basicPlusWordLogical(0, 'not' as BasicPlusWordLogicalOperator, 0)).toThrow(
      'Unsupported BASIC-PLUS word logical operator',
    );
    expect(() => basicPlusWordRelation(1 as unknown as boolean)).toThrow(
      'BASIC-PLUS relation result must be a boolean',
    );
  });
});
