import {describe, expect, test} from 'bun:test';
import * as publicAPI from '../index.ts';
import {parseBasicPlusMa2NumericExpression as parseMa2, parseProgram} from './parser.ts';
import {tokenize} from './tokenizer.ts';
import {BasicSyntaxError, Evaluator} from '../index.ts';
import type {Expression} from '../core/types.ts';
import reference from '../core/__tests__/ma2-decimal-reference.json';

function error(source: string) {
  try {
    parseMa2(source, {line: 5, offset: 90});
    throw new Error('Expected error');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
}
function nodes(root: Expression): Expression[] {
  const stack = [root],
    found: Expression[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    found.push(node);
    switch (node.type) {
      case 'Ma2NumberLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'Variable':
        break;
      case 'BinaryExpression':
        stack.push(node.right, node.left);
        break;
      case 'UnaryExpression':
        stack.push(node.argument);
        break;
      case 'GroupExpression':
        stack.push(node.expression);
        break;
      case 'CallExpression':
        stack.push(...node.arguments);
        break;
      case 'ArrayReference':
        stack.push(...node.indices);
        break;
    }
  }
  return found;
}

describe('internal MA2 numeric expression path through the shared parser', () => {
  test.each(reference.rows.map((row, i) => [i, row] as const))(
    'preserves captured ATOF expression %i',
    (_i, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Invalid capture');
      if (mask !== 0 || (psw & 2) !== 0) {
        expect(error(raw)).toMatchObject({
          code: 'UNSUPPORTED_NUMERIC_LITERAL',
          line: 5,
          column: 1,
          offset: 90,
        });
        return;
      }
      const node = parseMa2('\t' + raw, {line: 5, offset: 90});
      expect(node).toEqual({
        type: 'Ma2NumberLiteral',
        raw,
        words: [high, low],
        location: {
          label: null,
          start: {line: 5, column: 2, offset: 91},
          end: {line: 5, column: 2 + raw.length, offset: 91 + raw.length},
        },
      });
      expect(node).not.toHaveProperty('value');
      expect(Object.isFrozen(node)).toBe(true);
    },
  );
  test('uses historical short names, compact numeric grammar, signs and first-game calls', () => {
    const tree = parseMa2('ABS(-A1(1.5))+INT((2.5-1)/3)*+B(0,2)');
    expect(tree).toMatchObject({
      type: 'BinaryExpression',
      operator: '+',
      left: {type: 'CallExpression', name: 'ABS'},
      right: {type: 'BinaryExpression', operator: '*', left: {type: 'CallExpression', name: 'INT'}},
    });
    const all = nodes(tree);
    expect(all.some((node) => node.type === 'NumberLiteral')).toBe(false);
    expect(all.filter((node) => node.type === 'Ma2NumberLiteral')).toHaveLength(6);
    expect(all.filter((node) => node.type === 'ArrayReference').map((node) => node.name)).toEqual([
      'A1',
      'B',
    ]);
    expect(
      all.filter((node) => node.type === 'UnaryExpression').map((node) => node.operator),
    ).toEqual(['-', '+']);
    for (const node of all) {
      expect(Object.isFrozen(node)).toBe(true);
      expect(Object.isFrozen(node.location)).toBe(true);
      expect(() => Object.assign(node, {extra: 1})).toThrow(TypeError);
    }
    expect(error('a+1').code).toBe('UNSUPPORTED_LEXICAL_FORM');
  });
  test('retains the shared precedence and left-to-right operator tree for accepted forms', () => {
    expect(parseMa2('8/4/2-3+1')).toMatchObject({
      operator: '+',
      left: {
        operator: '-',
        left: {
          operator: '/',
          left: {operator: '/', left: {raw: '8'}, right: {raw: '4'}},
          right: {raw: '2'},
        },
        right: {raw: '3'},
      },
      right: {raw: '1'},
    });
    expect(parseMa2('-1+2*3')).toMatchObject({
      operator: '+',
      left: {type: 'UnaryExpression', operator: '-', argument: {raw: '1'}},
      right: {operator: '*'},
    });
    expect(parseMa2('-(1+2)*3')).toMatchObject({
      operator: '*',
      left: {
        type: 'UnaryExpression',
        argument: {type: 'GroupExpression', expression: {operator: '+'}},
      },
    });
  });
  test('requires one whole numeric expression and rejects unsupported kinds without native fallback', () => {
    for (const source of [
      '',
      '1 2',
      '1\n',
      '1\n2',
      '1:2',
      '1=2',
      'A(1,2,3)',
      'FOO(1)',
      '1REM x',
      '1!x',
      '1;2',
      '(1',
      '1+',
      'A()',
    ])
      expect(() => parseMa2(source)).toThrow(BasicSyntaxError);
    for (const source of ['"x"', "'x'", 'A$', 'A%(1)', 'A%', 'ABS(A$)'])
      expect(error(source).code).toBe('UNSUPPORTED_EXPRESSION');
    for (const source of ['RND', 'RND(0)', 'PI', 'SGN(1)', 'SIN(1)', 'FIX(1)', 'LOG10(1)'])
      expect(error(source).code).toBe('UNSUPPORTED_FUNCTION');
    for (const source of ['INT()', 'ABS(1,2)'])
      expect(error(source)).toMatchObject({
        code: 'INVALID_ARGUMENT_COUNT',
        line: 5,
        column: 1,
        offset: 90,
      });
    for (const source of ['1%', '1E999', '0'.repeat(256)])
      expect(error(source).code).toBe('UNSUPPORTED_NUMERIC_LITERAL');
    expect(error('2^3')).toMatchObject({code: 'UNSUPPORTED_OPERATOR', column: 2, offset: 91});
  });
  test('copies source options, freezes words and keeps signs outside unsigned raw text', () => {
    const options = {line: 8, offset: 200},
      tree = parseMa2('-\t1.0000001', options);
    options.line = 1;
    options.offset = 0;
    expect(tree).toMatchObject({
      type: 'UnaryExpression',
      operator: '-',
      argument: {
        type: 'Ma2NumberLiteral',
        raw: '1.0000001',
        words: [0x4080, 0],
        location: {
          label: null,
          start: {line: 8, column: 3, offset: 202},
          end: {line: 8, column: 12, offset: 211},
        },
      },
    });
    if (tree.type !== 'UnaryExpression' || tree.argument.type !== 'Ma2NumberLiteral')
      throw new Error('Expected signed literal');
    const argument = tree.argument;
    expect(Object.isFrozen(argument.words)).toBe(true);
    expect(() => Object.assign(argument.words, {0: 0})).toThrow(TypeError);
    for (const invalid of [{line: 0}, {line: 1.5}, {line: NaN}, {offset: -1}, {offset: Infinity}])
      expect(() => parseMa2('1', invalid)).toThrow(RangeError);
  });
  test('keeps long flat work iterative and enforces the existing nesting bound', () => {
    const flat = parseMa2(Array(6000).fill('1').join('+'));
    expect(nodes(flat)).toHaveLength(11999);
    expect(nodes(parseMa2('('.repeat(256) + '1' + ')'.repeat(256)))).toHaveLength(257);
    expect(error('('.repeat(257) + '1' + ')'.repeat(257)).code).toBe('EXPRESSION_TOO_DEEP');
    expect(error('-'.repeat(257) + '1').code).toBe('EXPRESSION_TOO_DEEP');
  });
  test('leaves native source, public exports, option rejection and direct native guards intact', () => {
    const statement = parseProgram('10 PRINT 1.0000001^2;INT(2.5)').lines[0].statement;
    expect(statement).toMatchObject({
      type: 'PrintStatement',
      items: [
        {
          type: 'BinaryExpression',
          operator: '^',
          left: {type: 'NumberLiteral', value: 1.0000001, raw: '1.0000001'},
        },
        {type: 'CallExpression', name: 'INT'},
      ],
    });
    expect('parseBasicPlusMa2NumericExpression' in publicAPI).toBe(false);
    expect(() =>
      publicAPI.parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2-unknown' as 'native'}),
    ).toThrow(TypeError);
    expect(() => new Evaluator().evaluate(parseMa2('1+2'))).toThrow('MA2 literals require');
    expect(
      tokenize('10PRINTINT(2.5)', {lexicalPolicy: 'basic-plus-1972-10'}).map((t) => t.type),
    ).toEqual(['LABEL', 'KEYWORD', 'KEYWORD', 'PUNCTUATION', 'RAW_NUMBER', 'PUNCTUATION', 'EOF']);
    expect(() =>
      tokenize('INT(1)', {numbered: false, lexicalPolicy: 'basic-plus-1972-10'}),
    ).toThrow(BasicSyntaxError);
    expect(() => publicAPI.parseProgram('10 PRINT (1')).toThrow(BasicSyntaxError);
  });
});
