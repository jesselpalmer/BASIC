import {describe, expect, test} from 'bun:test';
import {Basic, Evaluator, parseProgram} from '../index.ts';
import {prepareBasicPlusMa2Literal} from './basic_plus_ma2_literal.ts';
import {tokenize} from '../parser/tokenizer.ts';
import {
  bindMa2Words,
  bindMa2Literal,
  injectMa2Value,
  ma2Binary,
  ma2Unary,
  compareMa2Values,
  observeMa2Value,
  type Ma2Value,
  type Ma2BinaryResult,
} from './ma2_value.ts';
import addition from './__tests__/ma2-addition-reference.json';
import range from './__tests__/ma2-range-reference.json';
import multiplication from './__tests__/ma2-multiplication-reference.json';
import division from './__tests__/ma2-division-reference.json';
import values from './__tests__/ma2-values-reference.json';

function bound(words: readonly number[]): Ma2Value {
  const result = bindMa2Words(words);
  if (result.kind !== 'value') throw new Error('Expected canonical words');
  return result.value;
}
const descriptor = (words: readonly number[]): Ma2Value => ({
  kind: 'ma2',
  words: [words[0], words[1]],
});
const normal = (words: readonly number[]) => ({kind: 'value' as const, value: descriptor(words)});
function expectedEvent(
  condition: number,
  words: readonly number[],
): Extract<Ma2BinaryResult, {kind: 'numeric-event'}> {
  if (condition === 3)
    return {
      kind: 'numeric-event',
      code: 61,
      reason: 'division-by-zero',
      continuation: descriptor(words),
    };
  return {
    kind: 'numeric-event',
    code: 48,
    reason: condition === 1 ? 'overflow' : 'underflow',
    continuation: descriptor(words),
  };
}
// Deliberately forged unsupported values exercise the primitive trust boundary;
// ordinary execution will obtain descriptors only from the binding constructors.
const forged = (words: readonly number[]) => ({kind: 'ma2', words}) as Ma2Value;

describe('closed internal MA2 value binding', () => {
  test.each(addition.rows.filter((row) => row[5] === 0).map((row, i) => [i, row] as const))(
    'binds original normal add/subtract call %i',
    (_i, row) => {
      const [lh, ll, operation, rh, rl, , high, low] = row;
      if ([lh, ll, rh, rl, high, low].some((word) => word === null))
        throw new Error('Missing normal words');
      expect(
        ma2Binary(bound([lh!, ll!]), operation === 0 ? 'add' : 'subtract', bound([rh!, rl!])),
      ).toEqual(normal([high!, low!]));
    },
  );
  test.each(range.rows.map((row, i) => [i, row] as const))(
    'binds completed original add/subtract event call %i',
    (_i, [lh, ll, operation, rh, rl, condition, high, low]) => {
      const actual = ma2Binary(
        bound([lh, ll]),
        operation === 0 ? 'add' : 'subtract',
        bound([rh, rl]),
      );
      expect(actual).toEqual(
        condition === 0
          ? normal([high, low])
          : {
              kind: 'numeric-event',
              code: 48,
              reason: condition === 1 ? 'overflow' : 'underflow',
              continuation: descriptor([high, low]),
            },
      );
    },
  );
  for (const [operation, rows] of [
    ['multiply', multiplication.rows],
    ['divide', division.rows],
  ] as const) {
    test.each(rows.map((row, i) => [i, row] as const))(
      `binds original ${operation} call %i`,
      (_i, [lh, ll, rh, rl, condition, high, low]) => {
        expect(ma2Binary(bound([lh, ll]), operation, bound([rh, rl]))).toEqual(
          condition === 0 ? normal([high, low]) : expectedEvent(condition, [high, low]),
        );
      },
    );
  }
  test.each(values.unaryRows.map((row, i) => [i, row] as const))(
    'binds original unary call %i',
    (_i, row) => {
      expect(
        ma2Unary(bound(row.input), row.operation as 'integer' | 'absolute' | 'negate'),
      ).toEqual(normal(row.output));
    },
  );
  test.each(values.comparisonRows.map((row, i) => [i, row] as const))(
    'binds original comparison call %i',
    (_i, [lh, ll, rh, rl, order]) => {
      if (order !== -1 && order !== 0 && order !== 1) throw new Error('Invalid reference order');
      expect(compareMa2Values(bound([lh, ll]), bound([rh, rl]))).toEqual({kind: 'value', order});
    },
  );
  test('retains word-rounded intermediates and ordered multiplication without host reconstruction', () => {
    const one = bound([0x4080, 0]),
      half = bound([0x3480, 0]);
    const sum = ma2Binary(one, 'add', half);
    expect(sum).toEqual(normal([0x4080, 1]));
    if (sum.kind !== 'value') throw new Error('Expected normal sum');
    expect(ma2Binary(sum.value, 'subtract', one)).toEqual(normal([0x3500, 0]));
    expect(1 + 2 ** -24 - 1).toBe(2 ** -24);
    const left = bound([16565, 1266]),
      right = bound([16639, 65533]);
    expect(ma2Binary(left, 'multiply', right)).toEqual(normal([16693, 1264]));
    expect(ma2Binary(right, 'multiply', left)).toEqual(normal([16693, 1263]));
    expect(observeMa2Value(one)).toEqual({kind: 'value', value: 1});
  });
  test('keeps literal conversion separate from exact host injection and native execution', () => {
    const token = tokenize('10PRINT1.00000011920928955078125', {
      lexicalPolicy: 'basic-plus-1972-10',
    }).find((t) => t.type === 'RAW_NUMBER');
    if (token?.type !== 'RAW_NUMBER') throw new Error('Missing token');
    const prepared = prepareBasicPlusMa2Literal(token);
    if (prepared.kind !== 'value') throw new Error('Missing literal');
    expect(bindMa2Literal(prepared.literal)).toEqual(normal([0x4080, 0]));
    expect(injectMa2Value(1 + 2 ** -23)).toEqual(normal([0x4080, 1]));
    for (const input of [0.1, Infinity, Number.MIN_VALUE])
      expect(injectMa2Value(input).kind).toBe('unsupported');
    expect(injectMa2Value(-0)).toEqual(normal([0, 0]));
    const invalid = {
      ...prepared.literal,
      raw: '1E999',
      location: {
        ...prepared.literal.location,
        end: {...token.start, column: token.start.column + 5, offset: token.start.offset + 5},
      },
    };
    expect(bindMa2Literal(invalid)).toEqual({kind: 'unsupported', reason: 'conversion-status'});
    expect(() => bindMa2Literal({...prepared.literal, words: [0x4080, 1]})).toThrow(RangeError);
    expect(() => new Evaluator().evaluate(prepared.literal)).toThrow('MA2 literals require');
    expect(() =>
      parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2-unknown' as 'native'}),
    ).toThrow(TypeError);
    const basic = new Basic();
    basic.run('10 N=1.0000001');
    expect(basic.variables).toEqual([{name: 'N', value: 1.0000001}]);
  });
  test('validates factory domains without coercion, duplicate reads or iteration', () => {
    for (const input of [null, undefined, 1, '1', {}, new Uint16Array(2)])
      expect(() => bindMa2Words(input as readonly number[])).toThrow(TypeError);
    for (const input of [[], [1], [1, 2, 3], Array(1000000)])
      expect(() => bindMa2Words(input)).toThrow(RangeError);
    for (const word of [-1, 65536, 0.5, NaN, Infinity, '0', null])
      expect(() => bindMa2Words([0x4080, word] as number[])).toThrow(RangeError);
    expect(bindMa2Words([0x8000, 0])).toEqual({kind: 'unsupported', reason: 'signed-zero'});
    expect(bindMa2Words([0, 1])).toEqual({kind: 'unsupported', reason: 'zero-exponent-fraction'});
    expect(bindMa2Words([0x4080, 0, 0, 0])).toEqual({
      kind: 'unsupported',
      reason: 'four-word-precision',
    });
    const zeros = bound([-0, -0]);
    expect(Object.is(zeros.words[0], 0) && Object.is(zeros.words[1], 0)).toBe(true);
    for (const invalid of [null, 1, '1', {kind: 'native', words: [0x4080, 0]}]) {
      expect(() => observeMa2Value(invalid as unknown as Ma2Value)).toThrow(TypeError);
    }
    const reads = [0, 0],
      words = [0x4080, 1];
    for (let i = 0; i < 2; i++) {
      const word = words[i];
      Object.defineProperty(words, i, {
        get() {
          reads[i]++;
          return word;
        },
      });
    }
    Object.defineProperty(words, Symbol.iterator, {
      get() {
        throw new Error('iterator read');
      },
    });
    expect(bindMa2Words(words)).toEqual(normal([0x4080, 1]));
    expect(reads).toEqual([1, 1]);
    const one = bound([0x4080, 0]),
      bad = forged([0x8000, 0]);
    expect(ma2Binary(bad, 'add', one)).toEqual({
      kind: 'unsupported',
      operand: 'left',
      reason: 'signed-zero',
    });
    expect(ma2Unary(bad, 'absolute')).toEqual({kind: 'unsupported', reason: 'signed-zero'});
    expect(compareMa2Values(one, bad)).toEqual({
      kind: 'unsupported',
      operand: 'right',
      reason: 'signed-zero',
    });
    expect(observeMa2Value(bad)).toEqual({kind: 'unsupported', reason: 'signed-zero'});
    expect(() => ma2Binary(one, 'power' as 'add', one)).toThrow(RangeError);
    expect(() => ma2Unary(one, 'truncate' as 'integer')).toThrow(RangeError);
  });
  test('freezes detached values and keeps numeric events separate from normal values', () => {
    expect(Object.isFrozen(bindMa2Words([0x4080, 0]))).toBe(true);
    const input = [0x4080, 0],
      first = bound(input),
      second = bound(input);
    input.fill(0);
    expect(first).toEqual(descriptor([0x4080, 0]));
    expect(first).not.toBe(second);
    expect(first.words).not.toBe(second.words);
    const event = ma2Binary(bound([0x7fff, 65535]), 'add', bound([0x7fff, 65535]));
    expect(event).toEqual({
      kind: 'numeric-event',
      code: 48,
      reason: 'overflow',
      continuation: descriptor([0xff, 65535]),
    });
    expect(event).not.toHaveProperty('value');
    expect(event).not.toHaveProperty('words');
    if (event.kind !== 'numeric-event') throw new Error('Missing event');
    for (const object of [
      first,
      first.words,
      event,
      event.continuation,
      event.continuation.words,
    ]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
    }
  });
});
