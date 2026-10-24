import {describe, expect, it} from 'bun:test';
import {BasicRuntimeError, BasicSyntaxError, Evaluator, parseLine, parseProgram} from '../index.ts';
import type {BasicValue, Expression, NodeOf, SourceOptions} from './types.ts';

function expression(source: string, options?: SourceOptions): Expression {
  const statement = parseLine(`10 PRINT ${source}`, options)?.statement;
  if (statement?.type !== 'PrintStatement') throw new Error('Expected a PRINT expression');
  return statement.items[0];
}

function target(name: string): NodeOf<'Variable'> {
  const statement = parseLine(`20 LET ${name} = 0`)?.statement;
  if (statement?.type !== 'LetStatement') throw new Error('Expected a LET target');
  return statement.target;
}

function failure(action: () => unknown): BasicRuntimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error).not.toBeInstanceOf(BasicSyntaxError);
    return error;
  }
  throw new Error('Expected evaluation to fail');
}

describe('expression evaluation', () => {
  it.each<[string, BasicValue]>([
    ['42', 42],
    ['01.50', 1.5],
    ['.5 + 1.', 1.5],
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['8/4*2-3+1', 2],
    ['10-3-2', 5],
    ['24/6/2', 2],
    ['-2*+3', -6],
    ['--+2', 2],
    ['-(2+3)*4', -20],
    ['+(-.5)', -0.5],
    ['""', ''],
    ['"MiX ""Hi""\\n"', 'MiX "Hi"\\n'],
    ['"Hello"+" "+"world!"', 'Hello world!'],
    ['"1"+"2"', '12'],
    ['abs(-3.14)', 3.14],
    ['ABS(0)', 0],
    ['int(-1.6)', -2],
    ['INT(1.6)', 1],
    ['INT(2)', 2],
    ['ABS(INT(-1.6))', 2],
  ])('evaluates %s', (source, expected) => {
    expect(new Evaluator().evaluate(expression(source))).toBe(expected);
  });

  it('retains IEEE 754 arithmetic and signed zero', () => {
    const evaluator = new Evaluator();
    expect(evaluator.evaluate(expression('0.1+0.2'))).toBe(0.1 + 0.2);
    expect(Object.is(evaluator.evaluate(expression('-0')), -0)).toBe(true);
    expect(evaluator.evaluate(expression('ABS(-0)'))).toBe(0);
  });

  it.each(['0', '-0', '(1-1)'])('rejects division by %s at the operator', (divisor) => {
    const error = failure(() => new Evaluator().evaluate(expression(`1 / ${divisor}`)));
    expect(error.diagnostic).toMatchObject({
      code: 'DIVISION_BY_ZERO',
      label: 10,
      line: 1,
      column: 12,
      offset: 11,
    });
  });

  it.each(['"1"+2', '1+"2"', '"a"-"b"', '"a"*2', '2/"b"', '+"2"', '-"2"', 'ABS("2")', 'INT("2")'])(
    'rejects incompatible operands in %s without coercion',
    (source) => {
      expect(failure(() => new Evaluator().evaluate(expression(source))).diagnostic.code).toBe(
        'TYPE_MISMATCH',
      );
    },
  );

  it.each(['ABS()', 'ABS(1,2)', 'INT()', 'INT(1,2)', 'RND(1)'])(
    'validates arity in %s',
    (source) => {
      expect(failure(() => new Evaluator().evaluate(expression(source))).diagnostic).toMatchObject({
        code: 'INVALID_ARGUMENT_COUNT',
        label: 10,
        column: 10,
      });
    },
  );

  it('validates call arity before evaluating arguments', () => {
    let calls = 0;
    const evaluator = new Evaluator({
      random() {
        calls++;
        return 0.5;
      },
    });
    for (const source of ['ABS(RND(), RND())', 'RND(RND())', 'INT(MISSING, 2)']) {
      expect(failure(() => evaluator.evaluate(expression(source))).diagnostic.code).toBe(
        'INVALID_ARGUMENT_COUNT',
      );
    }
    expect(calls).toBe(0);
  });

  it.each(['*', '+', '/'])('rejects non-finite results of %s', (operator) => {
    const large = '9'.repeat(308);
    const source = operator === '/' ? `${large}/.1` : `${large}${operator}${large}`;
    expect(failure(() => new Evaluator().evaluate(expression(source))).diagnostic.code).toBe(
      'NON_FINITE_NUMBER',
    );
  });

  it.each([NaN, Infinity, -Infinity, '12oops', '12'])(
    'rejects malformed numeric values supplied to evaluation: %s',
    (value) => {
      const node = {...expression('1')};
      // Exercise the JavaScript/constructed-node boundary without weakening API types.
      Reflect.set(node, 'value', value);
      const error = failure(() => new Evaluator().evaluate(node));
      expect(error.diagnostic.code).toBe(
        typeof value === 'number' ? 'NON_FINITE_NUMBER' : 'TYPE_MISMATCH',
      );
      expect(error.diagnostic.column).toBe(10);
    },
  );

  it('keeps malformed source numbers at the lexical boundary', () => {
    expect(() => expression('12oops')).toThrow(BasicSyntaxError);
  });

  it('uses the original physical position after numeric program sorting', () => {
    const program = parseProgram('90 END\r\n20 PRINT 1 / 0');
    const statement = program.lines[0].statement;
    if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
    const error = failure(() => new Evaluator().evaluate(statement.items[0]));
    expect(error.name).toBe('BasicRuntimeError');
    expect(error.message).toBe('Line 20, column 12: Cannot divide by zero');
    expect(error.diagnostic).toEqual({
      code: 'DIVISION_BY_ZERO',
      message: 'Cannot divide by zero',
      label: 20,
      line: 2,
      column: 12,
      offset: 19,
    });
  });

  it('retains fragment offsets and reports undefined names at their token', () => {
    const error = failure(() =>
      new Evaluator().evaluate(expression('1 + missing', {line: 8, offset: 200})),
    );
    expect(error.diagnostic).toMatchObject({
      code: 'UNDEFINED_VARIABLE',
      message: 'Undefined variable MISSING',
      label: 10,
      line: 8,
      column: 14,
      offset: 213,
    });
  });

  it('locates unary and built-in type errors at their operator or function', () => {
    for (const source of ['-"a"', 'INT("a")']) {
      const error = failure(() => new Evaluator().evaluate(expression(source)));
      expect(error.diagnostic).toMatchObject({code: 'TYPE_MISMATCH', column: 10});
    }
  });

  it('handles long flat expressions without overflowing the call stack', () => {
    expect(new Evaluator().evaluate(expression(Array(6000).fill('1').join('+')))).toBe(6000);
  });

  it.each(['group', 'unary', 'call'])('evaluates the parser maximum nesting for %s', (kind) => {
    const source =
      kind === 'group'
        ? '('.repeat(256) + '1' + ')'.repeat(256)
        : kind === 'unary'
          ? '-'.repeat(256) + '1'
          : 'ABS('.repeat(256) + '1' + ')'.repeat(256);
    expect(new Evaluator().evaluate(expression(source))).toBe(1);
  });

  it('fails clearly for unsupported constructed operators and functions', () => {
    for (const [source, field, value, code] of [
      ['1+2', 'operator', '^', 'UNSUPPORTED_OPERATOR'],
      ['-1', 'operator', '~', 'UNSUPPORTED_OPERATOR'],
      ['ABS(1)', 'name', 'SQRT', 'UNKNOWN_FUNCTION'],
    ]) {
      const node = {...expression(source)};
      Reflect.set(node, field, value);
      expect(failure(() => new Evaluator().evaluate(node)).diagnostic.code).toBe(code);
    }
  });

  it('supports diagnostics without a BASIC label', () => {
    const node = expression('MISSING');
    const error = failure(() =>
      new Evaluator().evaluate({...node, location: {...node.location, label: null}}),
    );
    expect(error.message).toBe('Source line 1, column 10: Undefined variable MISSING');
    expect(error.diagnostic.label).toBeNull();
  });
});

describe('typed variables', () => {
  it('assigns and reassigns case-insensitive numeric and string names', () => {
    const evaluator = new Evaluator();
    evaluator.assign(target('sCoRe'), 3);
    evaluator.assign(target('name$'), 'MiX');
    expect(evaluator.evaluate(expression('SCORE * 2'))).toBe(6);
    expect(evaluator.evaluate(expression('NaMe$ + "!"'))).toBe('MiX!');
    evaluator.assign(target('SCORE'), evaluator.evaluate(expression('score + 1')));
    expect(evaluator.evaluate(expression('score'))).toBe(4);
    // Also normalize parser-shaped variable nodes supplied by an embedding host.
    evaluator.assign({...target('A'), name: 'a'}, 5);
    expect(evaluator.evaluate({...target('A'), name: 'a'})).toBe(5);
    evaluator.assign(target('name$'), '');
    evaluator.assign(target('score'), 0);
    expect(evaluator.evaluate(expression('name$'))).toBe('');
    expect(evaluator.evaluate(expression('score'))).toBe(0);
  });

  it.each<[string, BasicValue]>([
    ['A', '3'],
    ['A$', 3],
    ['A', NaN],
    ['A', Infinity],
    ['A', -Infinity],
  ])('rejects assignment of %s = %s before changing its value', (name, value) => {
    const evaluator = new Evaluator();
    const initial = name.endsWith('$') ? 'kept' : 7;
    evaluator.assign(target(name), initial);
    const error = failure(() => evaluator.assign(target(name), value));
    expect(error.diagnostic).toMatchObject({label: 20, column: 8});
    expect(evaluator.evaluate(expression(name))).toBe(initial);
  });

  it('does not share variables between instances and clears them on reset', () => {
    const first = new Evaluator();
    const second = new Evaluator();
    first.assign(target('A'), 1);
    first.assign(target('A$'), 'one');
    expect(failure(() => second.evaluate(expression('A'))).diagnostic.code).toBe(
      'UNDEFINED_VARIABLE',
    );
    second.assign(target('A'), 2);
    first.reset();
    for (const name of ['A', 'A$']) {
      expect(failure(() => first.evaluate(expression(name))).diagnostic.code).toBe(
        'UNDEFINED_VARIABLE',
      );
    }
    expect(second.evaluate(expression('A'))).toBe(2);
    first.assign(target('A'), 3);
    expect(first.evaluate(expression('A'))).toBe(3);
  });

  it('treats object property names as ordinary undefined variables', () => {
    const evaluator = new Evaluator();
    for (const name of ['constructor', 'toString']) {
      expect(failure(() => evaluator.evaluate(expression(name))).diagnostic.code).toBe(
        'UNDEFINED_VARIABLE',
      );
      evaluator.assign(target(name), 4);
      expect(evaluator.evaluate(expression(name))).toBe(4);
    }
  });

  it('preserves variables and accepts later evaluations after failure', () => {
    const evaluator = new Evaluator();
    evaluator.assign(target('A'), 3);
    const tree = expression('A + (1 / 0)');
    failure(() => evaluator.evaluate(tree));
    expect(evaluator.evaluate(expression('A+2'))).toBe(5);
    expect(tree).toEqual(expression('A + (1 / 0)'));
  });
});

describe('injected randomness', () => {
  it('evaluates calls and binary operands left to right using the host receiver', () => {
    const host = {
      values: [0.1, 0.2, 0.3, 0.4],
      index: 0,
      random() {
        return this.values[this.index++];
      },
    };
    const evaluator = new Evaluator(host);
    expect(evaluator.evaluate(expression('RND() - (RND() * 2) + ABS(RND())'))).toBe(
      0.1 - 0.2 * 2 + 0.3,
    );
    expect(host.index).toBe(3);
    evaluator.reset();
    expect(evaluator.evaluate(expression('INT(RND()*100)+1'))).toBe(41);
    expect(host.index).toBe(4);
  });

  it('does not call later operands when the first fails', () => {
    let calls = 0;
    const evaluator = new Evaluator({
      random() {
        calls++;
        return 0.5;
      },
    });
    failure(() => evaluator.evaluate(expression('MISSING + RND()')));
    failure(() => evaluator.evaluate(expression('(1/0) + RND()')));
    expect(calls).toBe(0);
    expect(evaluator.evaluate(expression('RND()'))).toBe(0.5);
    expect(calls).toBe(1);
  });

  it.each([0, 1 - Number.EPSILON])('accepts the random boundary %s', (value) => {
    expect(new Evaluator({random: () => value}).evaluate(expression('RND()'))).toBe(value);
  });

  it('uses valid default randomness', () => {
    const value = new Evaluator().evaluate(expression('RND()'));
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it.each([-0.1, 1, 1.1, NaN, Infinity, -Infinity, '0.5', undefined])(
    'rejects an invalid host random result: %s',
    (value) => {
      const host = {};
      Reflect.set(host, 'random', () => value);
      expect(
        failure(() => new Evaluator(host).evaluate(expression('RND()'))).diagnostic,
      ).toMatchObject({
        code: 'INVALID_RANDOM_VALUE',
        label: 10,
        column: 10,
      });
    },
  );

  it('wraps host random failures with the function location and original cause', () => {
    const cause = new Error('host failure');
    let broken = true;
    const evaluator = new Evaluator({
      random() {
        if (broken) throw cause;
        return 0.5;
      },
    });
    const error = failure(() => evaluator.evaluate(expression('1 + RND()')));
    expect(error.cause).toBe(cause);
    expect(error.diagnostic).toMatchObject({code: 'RANDOM_FAILED', label: 10, column: 14});
    broken = false;
    expect(evaluator.evaluate(expression('RND()'))).toBe(0.5);
  });
});
