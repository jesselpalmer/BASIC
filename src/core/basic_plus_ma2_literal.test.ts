import {describe, expect, test} from 'bun:test';
import {
  Basic,
  Evaluator,
  BasicSyntaxError,
  BasicRuntimeError,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {Expression, NodeOf, TokenOf, Position} from './types.ts';
import {tokenize} from '../parser/tokenizer.ts';
import {prepareBasicPlusMa2Literal, validateBasicPlusMa2Literal} from './basic_plus_ma2_literal.ts';
import {expressionType} from './comparison.ts';
import {firstMa2Literal} from './foreign_literal.ts';
import reference from './__tests__/ma2-decimal-reference.json';

function token(raw: string): TokenOf<'RAW_NUMBER'> {
  const found = tokenize('\t10PRINT' + raw, {
    lexicalPolicy: 'basic-plus-1972-10',
    line: 4,
    offset: 80,
  }).find((item) => item.type === 'RAW_NUMBER');
  if (found?.type !== 'RAW_NUMBER') throw new Error('Missing raw token');
  return found;
}
function literal(raw = '1'): NodeOf<'Ma2NumberLiteral'> {
  const result = prepareBasicPlusMa2Literal(token(raw));
  if (result.kind !== 'value') throw new Error('Expected literal');
  return result.literal;
}
function diagnostic(
  call: () => unknown,
  errorClass: typeof BasicSyntaxError | typeof BasicRuntimeError,
) {
  try {
    call();
    throw new Error('Expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(errorClass);
    if (!(error instanceof errorClass)) throw error;
    return error.diagnostic;
  }
}

describe('internal selected-MA2 literal preparation and native boundary', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'prepares original ATOF spelling %i exactly',
    (_index, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Invalid reference');
      const source = token(raw),
        result = prepareBasicPlusMa2Literal(source);
      if (mask !== 0) expect(result).toEqual({kind: 'unsupported', reason: 'numeric-event'});
      else if (psw & 2) expect(result).toEqual({kind: 'unsupported', reason: 'conversion-status'});
      else {
        expect(result).toEqual({
          kind: 'value',
          literal: {
            type: 'Ma2NumberLiteral',
            raw,
            words: [high, low],
            location: {label: 10, start: source.start, end: source.end},
          },
        });
        if (result.kind !== 'value') throw new Error('Expected value');
        expect(validateBasicPlusMa2Literal(result.literal)).toEqual(result);
        expect(expressionType(result.literal)).toBe('number');
        expect(Object.hasOwn(result.literal, 'value')).toBe(false);
      }
    },
  );
  test('keeps integer, input-limit and unsupported supplied literal boundaries explicit', () => {
    expect(prepareBasicPlusMa2Literal(token('4%'))).toEqual({
      kind: 'unsupported',
      reason: 'integer-kind',
    });
    expect(prepareBasicPlusMa2Literal(token('0'.repeat(256)))).toEqual({
      kind: 'unsupported',
      reason: 'input-limit',
    });
    const unsupported = {
      ...literal(),
      raw: '1E999',
      location: {...literal().location, end: {line: 4, column: 14, offset: 93}},
      get words(): readonly [number, number] {
        throw new Error('read unsupported words');
      },
    };
    expect(validateBasicPlusMa2Literal(unsupported)).toEqual({
      kind: 'unsupported',
      reason: 'conversion-status',
    });
  });
  test('copies locations and words, reads supplied words once, and freezes all retained objects', () => {
    const original = token('1');
    const start = {...original.start},
      end = {...original.end};
    const result = prepareBasicPlusMa2Literal({...original, start, end});
    start.column = 99;
    end.offset = 999;
    if (result.kind !== 'value') throw new Error('Expected value');
    expect(result.literal.location.start.column).toBe(9);
    expect(result.literal.location.end.offset).toBe(89);
    const reads = [0, 0];
    const words = [0x4080, 0];
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
    const validated = validateBasicPlusMa2Literal({
      ...result.literal,
      words: words as [number, number],
    });
    expect(validated).toEqual(result);
    expect(reads).toEqual([1, 1]);
    for (const object of [
      result,
      result.literal,
      result.literal.words,
      result.literal.location,
      result.literal.location.start,
      result.literal.location.end,
    ]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
    }
  });
  test('rejects malformed tokens, positions, literal containers and word/raw mismatches', () => {
    const base = token('1'),
      node = literal();
    for (const value of [
      null,
      undefined,
      1,
      {type: 'NUMBER', value: 1},
      {...base, value: 1},
      {...base, raw: 1},
    ])
      expect(() => prepareBasicPlusMa2Literal(value as unknown as TokenOf<'RAW_NUMBER'>)).toThrow(
        TypeError,
      );
    for (const position of [
      null,
      1,
      {line: 0, column: 1, offset: 0},
      {line: 1, column: 0, offset: 0},
      {line: 1, column: 1, offset: -1},
      {line: NaN, column: 1, offset: 0},
    ])
      expect(() => prepareBasicPlusMa2Literal({...base, start: position as Position})).toThrow();
    for (const label of [0, 32768, NaN])
      expect(() => prepareBasicPlusMa2Literal({...base, label})).toThrow(RangeError);
    for (const end of [
      {...base.end, line: 5},
      {...base.end, column: 100},
      {...base.end, offset: 100},
    ])
      expect(() => prepareBasicPlusMa2Literal({...base, end})).toThrow(RangeError);
    expect(prepareBasicPlusMa2Literal({...base, label: null})).toMatchObject({kind: 'value'});
    for (const raw of ['.', '1E+', '-1'])
      expect(() =>
        prepareBasicPlusMa2Literal({
          ...base,
          raw,
          end: {
            ...base.end,
            column: base.start.column + raw.length,
            offset: base.start.offset + raw.length,
          },
        }),
      ).toThrow(SyntaxError);
    for (const value of [
      null,
      1,
      {type: 'NumberLiteral'},
      {...node, raw: 1},
      {...node, location: null},
    ])
      expect(() => validateBasicPlusMa2Literal(value as NodeOf<'Ma2NumberLiteral'>)).toThrow(
        TypeError,
      );
    for (const words of [
      null,
      {},
      [],
      [1],
      [0, 0, 0, 0],
      [0x8000, 0],
      [0, 0],
      [0x4080, 1],
      [0x4080, NaN],
      [0x4080, 65536],
      [0x4080, -1],
      [0x4080, 0.5],
      [0x4080, '0'],
    ])
      expect(() =>
        validateBasicPlusMa2Literal({...node, words: words as [number, number]}),
      ).toThrow();
  });
  test('rejects a foreign literal before native direct evaluation, comparison or index effects', () => {
    let effects = 0;
    const evaluator = new Evaluator({
      random: () => {
        effects++;
        return 0.5;
      },
    });
    const node = literal();
    const program = parseProgram(
      '10 DIM A(2,2)\n20 PRINT RND()\n30 IF RND()=1 THEN 40\n40 A(RND(),1)=2',
    );
    const print = program.lines[1].statement,
      condition = program.lines[2].statement,
      assign = program.lines[3].statement;
    if (
      print.type !== 'PrintStatement' ||
      condition.type !== 'IfStatement' ||
      assign.type !== 'LetStatement' ||
      assign.target.type !== 'ArrayReference'
    )
      throw new Error('Expected native nodes');
    const random = print.items[0];
    const target = assign.target;
    expect(diagnostic(() => evaluator.evaluate(node), BasicRuntimeError)).toMatchObject({
      code: 'UNSUPPORTED_NUMERIC_LITERAL',
      label: 10,
      line: 4,
      column: 9,
      offset: 88,
    });
    const binary: Expression = {
      type: 'BinaryExpression',
      operator: '+',
      operatorLocation: node.location,
      location: node.location,
      left: random,
      right: node,
    };
    diagnostic(() => evaluator.evaluate(binary), BasicRuntimeError);
    diagnostic(() => evaluator.compare({...condition.condition, right: node}), BasicRuntimeError);
    diagnostic(() => evaluator.assign({...target, indices: [random, node]}, 1), BasicRuntimeError);
    expect(effects).toBe(0);
    expect(evaluator.snapshotVariables()).toEqual([]);
  });
  test('rejects supplied dead/late nodes before effects and preserves a prepared replacement snapshot', () => {
    const node = literal();
    const output: string[] = [];
    const basic = new Basic({write: (value) => output.push(value)});
    basic.run('10 PRINT "saved"');
    output.length = 0;
    const source = parseProgram('10 PRINT "before"\n20 END\n30 IF 1=2 THEN PRINT 1\n40 PRINT 1');
    const lines = source.lines.map((line) => {
      if (line.label !== 40) return line;
      const statement = line.statement;
      if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
      const foreign = {...node};
      Object.defineProperty(foreign, 'words', {
        get() {
          throw new Error('observed words');
        },
      });
      return {...line, statement: {...statement, items: [foreign]}};
    });
    expect(diagnostic(() => validateProgram(lines), BasicSyntaxError).code).toBe(
      'UNSUPPORTED_NUMERIC_LITERAL',
    );
    diagnostic(() => basic.run({type: 'Program', lines}), BasicSyntaxError);
    expect(output).toEqual([]);
    basic.run();
    expect(output).toEqual(['saved\n']);
    const conditional = source.lines[2].statement;
    if (
      conditional.type !== 'InlineIfStatement' ||
      conditional.consequent.type !== 'PrintStatement'
    )
      throw new Error('Expected inline PRINT');
    const dead = {
      ...source.lines[2],
      statement: {...conditional, consequent: {...conditional.consequent, items: [node]}},
    };
    diagnostic(() => validateProgram([source.lines[0], dead]), BasicSyntaxError);
  });
  test('searches deep/shared/cyclic trees iteratively and leaves ordinary native parsing unchanged', () => {
    const node = literal();
    let deep: unknown = node;
    for (let i = 0; i < 10000; i++) deep = {child: deep};
    expect(firstMa2Literal(deep)).toBe(node);
    const shared: Record<string, unknown> = {value: 1};
    shared.loop = shared;
    expect(firstMa2Literal([null, 1, shared, shared])).toBe(null);
    const native = parseProgram('10 PRINT 1.0000001').lines[0].statement;
    if (native.type !== 'PrintStatement') throw new Error('Expected PRINT');
    expect(native.items[0]).toMatchObject({
      type: 'NumberLiteral',
      raw: '1.0000001',
      value: 1.0000001,
    });
    expect(() => parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
    expect(
      expressionType({type: 'GroupExpression', expression: node, location: node.location}),
    ).toBe('number');
  });
});
