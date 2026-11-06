import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {evaluateBasicPlusMa2Constant as evaluate, requireMa2ConstantSyntax} from './evaluator.ts';
import {parseBasicPlusMa2NumericExpression as parseMa2} from '../parser/parser.ts';
import type {Expression} from './types.ts';
import decimal from './__tests__/ma2-decimal-reference.json';
import addition from './__tests__/ma2-addition-reference.json';
import multiplication from './__tests__/ma2-multiplication-reference.json';
import division from './__tests__/ma2-division-reference.json';

const spellings = new Map<string, string>();
for (const [raw, high, low, , psw, mask] of decimal.rows) {
  if (
    typeof raw !== 'string' ||
    typeof high !== 'number' ||
    typeof low !== 'number' ||
    typeof psw !== 'number' ||
    typeof mask !== 'number'
  )
    throw new Error('Invalid decimal capture');
  if (mask !== 0 || (psw & 2) !== 0) continue;
  if (!spellings.has(`${high},${low}`)) spellings.set(`${high},${low}`, raw);
  if (high || low) {
    const key = `${high ^ 32768},${low}`;
    if (!spellings.has(key)) spellings.set(key, '-' + raw);
  }
}
const joined: {source: string; words: number[]; event: number}[] = [];
for (const [operation, rows] of [
  ['add', addition.rows],
  ['multiply', multiplication.rows],
  ['divide', division.rows],
] as const) {
  for (const row of rows) {
    const [lh, ll, op, rh, rl, condition, high, low] =
      operation === 'add' ? row : [row[0], row[1], 0, row[2], row[3], row[4], row[5], row[6]];
    const left = spellings.get(`${lh},${ll}`),
      right = spellings.get(`${rh},${rl}`);
    if (
      left === undefined ||
      right === undefined ||
      high === null ||
      low === null ||
      condition === null
    )
      continue;
    const operator =
      operation === 'add' ? (op === 0 ? '+' : '-') : operation === 'multiply' ? '*' : '/';
    joined.push({source: `(${left}) ${operator} (${right})`, words: [high, low], event: condition});
  }
}
const normal = (words: readonly number[]) =>
  ({kind: 'value', value: {kind: 'ma2', words: [words[0], words[1]]}}) as const;
function diagnostic(source: string) {
  try {
    evaluate(source, {line: 5, offset: 80});
    throw new Error('Expected syntax rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(api.BasicSyntaxError);
    if (!(error instanceof api.BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
}

describe('constant selected-MA2 source through the shared evaluator', () => {
  test.each(decimal.rows.map((row, i) => [i, row] as const))(
    'matches captured source value or unsupported conversion %i',
    (_i, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Invalid capture');
      if (mask !== 0 || (psw & 2) !== 0)
        expect(diagnostic(raw).code).toBe('UNSUPPORTED_NUMERIC_LITERAL');
      else expect(evaluate(raw)).toEqual(normal([high, low]));
    },
  );
  test.each(joined.map((row, i) => [i, row] as const))(
    'matches joined independent source/arithmetic capture %i',
    (_i, row) => {
      const result = evaluate(row.source);
      if (row.event === 0) expect(result).toEqual(normal(row.words));
      else
        expect(result).toMatchObject({
          kind: 'numeric-event',
          code: row.event === 3 ? 61 : 48,
          reason: row.event === 3 ? 'division-by-zero' : row.event === 1 ? 'overflow' : 'underflow',
          continuation: {kind: 'ma2', words: row.words},
        });
    },
  );
  test('keeps retained source/arithmetic joins nonempty and tests word-rounded chains', () => {
    expect(joined).toHaveLength(28);
    expect(evaluate('(16777216+1)-16777216')).toEqual(normal([0x4100, 0]));
    expect(16777216 + 1 - 16777216).toBe(1);
    expect(evaluate('INT(2.5)+ABS(-3)')).toEqual(normal([0x41a0, 0]));
    expect(evaluate('INT(-.5)')).toEqual(normal([0xc080, 0]));
    expect(evaluate('+(-(-1))')).toEqual(normal([0x4080, 0]));
    expect(evaluate('8/4/2-3+1')).toEqual(normal([0xc080, 0]));
  });
  test('returns the first event with its frozen physical operator location without continuation', () => {
    for (const [source, code, reason] of [
      ['1/0+2', 61, 'division-by-zero'],
      ['1E38*10', 48, 'overflow'],
      ['1E-38/10', 48, 'underflow'],
    ] as const) {
      const result = evaluate(source, {line: 7, offset: 100});
      expect(result).toMatchObject({
        kind: 'numeric-event',
        code,
        reason,
        continuation: {kind: 'ma2', words: [0, 0]},
      });
      if (result.kind !== 'numeric-event') throw new Error('Missing event');
      expect(result).not.toHaveProperty('value');
      expect(result).not.toHaveProperty('diagnostic');
      const column = source.indexOf(source.includes('*') ? '*' : '/') + 1;
      expect(result.location).toEqual({
        label: null,
        start: {line: 7, column, offset: 100 + column - 1},
        end: {line: 7, column: column + 1, offset: 100 + column},
      });
      for (const object of [
        result,
        result.continuation,
        result.continuation.words,
        result.location,
        result.location.start,
        result.location.end,
      ]) {
        expect(Object.isFrozen(object)).toBe(true);
        expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
      }
    }
    expect(evaluate('(1/0)+(1E38*10)')).toMatchObject({
      kind: 'numeric-event',
      code: 61,
      location: {start: {column: 3}},
    });
  });
  test('preflights every stateful form before calculation and preserves private public context', () => {
    expect(diagnostic('(1/0)+A')).toMatchObject({
      code: 'UNSUPPORTED_EXPRESSION',
      column: 7,
      offset: 86,
    });
    expect(diagnostic('INT(A(1))').code).toBe('UNSUPPORTED_EXPRESSION');
    for (const source of ['RND', 'RND(0)', '2^3', 'INT()', '1%', '"x"', '1 2'])
      expect(() => evaluate(source)).toThrow(api.BasicSyntaxError);
    const binary = parseMa2('1+2'),
      unary = parseMa2('-1'),
      call = parseMa2('INT(1)');
    if (
      binary.type !== 'BinaryExpression' ||
      unary.type !== 'UnaryExpression' ||
      call.type !== 'CallExpression'
    )
      throw new Error('Expected syntax fixtures');
    expect(() => requireMa2ConstantSyntax({...binary, operator: '^'})).toThrow(
      api.BasicSyntaxError,
    );
    expect(() => requireMa2ConstantSyntax({...unary, operator: 'NOT'})).toThrow(
      api.BasicSyntaxError,
    );
    expect(() => requireMa2ConstantSyntax({...call, name: 'RND'})).toThrow(api.BasicSyntaxError);
    expect(() => requireMa2ConstantSyntax({...call, arguments: []})).toThrow(api.BasicSyntaxError);
    const ordinary = api.parseProgram('10 PRINT 1;"x"').lines[0].statement;
    if (ordinary.type !== 'PrintStatement') throw new Error('Expected native literal fixtures');
    for (const item of ordinary.items)
      expect(() => requireMa2ConstantSyntax(item)).toThrow(api.BasicSyntaxError);
    expect('evaluateBasicPlusMa2Constant' in api).toBe(false);
    expect(() => new api.Evaluator({}, {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
    const source = api.parseProgram('10 PRINT 1.0000001').lines[0].statement;
    if (source.type !== 'PrintStatement') throw new Error('Expected PRINT');
    expect(new api.Evaluator().evaluate(source.items[0])).toBe(1.0000001);
  });
  test('keeps flat work iterative, bounded nesting and detached results', () => {
    expect(evaluate(Array(6000).fill('1').join('+'))).toEqual(normal([0x46bb, 0x8000]));
    expect(evaluate('('.repeat(256) + '1' + ')'.repeat(256))).toEqual(normal([0x4080, 0]));
    expect(() => evaluate('('.repeat(257) + '1' + ')'.repeat(257))).toThrow(api.BasicSyntaxError);
    const a = evaluate('1'),
      b = evaluate('1');
    expect(a).not.toBe(b);
    if (a.kind !== 'value' || b.kind !== 'value') throw new Error('Expected normal values');
    expect(a.value).not.toBe(b.value);
    expect(a.value.words).not.toBe(b.value.words);
    expect(Object.isFrozen(a.value)).toBe(true);
  });
  test('preserves native arity/effect order and live array owner replacement during callbacks', () => {
    const program = api.parseProgram(
      '10 DIM A(1)\n20 PRINT A(0)\n30 PRINT A(RND())\n40 PRINT RND()+RND()',
    );
    const dim = program.lines[0].statement,
      first = program.lines[1].statement,
      read = program.lines[2].statement,
      sum = program.lines[3].statement;
    if (
      dim.type !== 'DimStatement' ||
      first.type !== 'PrintStatement' ||
      read.type !== 'PrintStatement' ||
      sum.type !== 'PrintStatement'
    )
      throw new Error('Expected native forms');
    const target = first.items[0];
    if (target.type !== 'ArrayReference') throw new Error('Expected array');
    let calls = 0;
    const evaluator = new api.Evaluator({
      random: () => {
        calls++;
        evaluator.reset(dim.declarations);
        return 0;
      },
    });
    evaluator.reset(dim.declarations);
    evaluator.assign(target, 9);
    expect(evaluator.evaluate(read.items[0])).toBe(0);
    expect(calls).toBe(1);
    const bad: Expression = {
      type: 'CallExpression',
      name: 'INT',
      nameLocation: target.location,
      location: target.location,
      arguments: [sum.items[0], sum.items[0]],
    };
    expect(() => evaluator.evaluate(bad)).toThrow('expects 1');
    expect(calls).toBe(1);
    const trace: number[] = [];
    const ordered = new api.Evaluator({
      random: () => {
        trace.push(trace.length);
        return trace.length / 10;
      },
    });
    expect(ordered.evaluate(sum.items[0])).toBeCloseTo(0.3, 12);
    expect(trace).toEqual([0, 1]);
  });
});
