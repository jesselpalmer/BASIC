import {describe, expect, it} from 'bun:test';
import {Basic, BasicRuntimeError, Evaluator, parseLine, parseProgram} from '../index.ts';
import {expressionType} from './comparison.ts';
import {nativeIntrinsic} from './intrinsics.ts';
import type {BasicValue, Expression, Host, NodeOf, SourceOptions} from './types.ts';

function expression(source: string, options?: SourceOptions): Expression {
  const statement = parseLine(`10 PRINT ${source}`, options)?.statement;
  if (statement?.type !== 'PrintStatement') throw Error('Expected PRINT');
  return statement.items[0];
}

function call(source: string): NodeOf<'CallExpression'> {
  const node = expression(source);
  if (node.type !== 'CallExpression') throw Error('Expected call');
  return node;
}

function failure(action: () => unknown): BasicRuntimeError {
  try {
    action();
  } catch (error) {
    if (!(error instanceof BasicRuntimeError)) throw error;
    return error;
  }
  throw Error('Expected runtime failure');
}

function observedHost() {
  const trace: string[] = [];
  const host: Partial<Host> = {
    random() {
      trace.push('random');
      return 0.25;
    },
    readKey() {
      trace.push('readKey');
      return 'A';
    },
    keyDown(key) {
      trace.push(`keyDown:${key}`);
      return key === 'A' || key === 'UP';
    },
  };
  return {host, trace};
}

describe('shared native intrinsic signatures', () => {
  it.each<
    [
      NonNullable<ReturnType<typeof nativeIntrinsic>>['name'],
      0 | 1,
      'number' | 'string',
      string,
      BasicValue,
      string[],
    ]
  >([
    ['ABS', 1, 'number', 'ABS(-3)', 3, []],
    ['INT', 1, 'number', 'INT(-1.2)', -2, []],
    ['RND', 0, 'number', 'RND()', 0.25, ['random']],
    ['INKEY$', 0, 'string', 'INKEY$()', 'A', ['readKey']],
    ['KEYDOWN', 1, 'number', 'KEYDOWN("UP")', 1, ['keyDown:UP']],
  ])(
    'keeps %s parsing, inference and execution aligned',
    (name, arity, resultType, source, value, effects) => {
      const signature = nativeIntrinsic(name);
      expect(signature).toEqual({name, arity, resultType});
      expect(signature).toBe(nativeIntrinsic(name));
      expect(Object.isFrozen(signature)).toBe(true);
      expect(() => Object.assign(signature!, {arity: 9})).toThrow(TypeError);
      const node = call(source.toLowerCase());
      expect(node.name).toBe(name);
      expect(node.nameLocation.start.column).toBe(10);
      expect(expressionType(node)).toBe(resultType);
      const {host, trace} = observedHost();
      expect(new Evaluator(host).evaluate(node)).toBe(value);
      expect(trace).toEqual(effects);
    },
  );

  it.each([
    '',
    'abs',
    'inkey$',
    'SQR',
    'EXP',
    'LEFT',
    'PI',
    'toString',
    'constructor',
    '__proto__',
  ])('does not recognize an alias or inherited property named %s', (name) => {
    expect(nativeIntrinsic(name)).toBeNull();
  });

  it.each([
    'ABS(RND(),INKEY$())',
    'INT(RND(),KEYDOWN("UP"))',
    'RND(INKEY$())',
    'INKEY$(RND())',
    'KEYDOWN(RND(),INKEY$())',
  ])('rejects arity before arguments have effects in %s', (source) => {
    const {host, trace} = observedHost();
    const node = call(source);
    const error = failure(() => new Evaluator(host).evaluate(node));
    expect(error.diagnostic).toMatchObject({
      code: 'INVALID_ARGUMENT_COUNT',
      message: `${node.name} expects ${nativeIntrinsic(node.name)!.arity} argument(s)`,
      label: 10,
      line: 1,
      column: 10,
      offset: 9,
    });
    expect(trace).toEqual([]);
  });

  it.each(['abs', 'SQR', 'toString', 'constructor', '__proto__'])(
    'rejects constructed unknown %s before its arguments or arity',
    (name) => {
      const node = {...call('ABS(RND())'), name};
      const {host, trace} = observedHost();
      const error = failure(() => new Evaluator(host).evaluate(node));
      expect(error.diagnostic).toMatchObject({
        code: 'UNKNOWN_FUNCTION',
        message: `Unknown function ${name}`,
        column: 10,
        offset: 9,
      });
      // Unknown constructed names retain the previous inference fallback.
      expect(expressionType(node)).toBe('number');
      expect(trace).toEqual([]);
    },
  );

  it('evaluates nested calls once, left to right, through the shared iterative driver', () => {
    const {host, trace} = observedHost();
    const evaluator = new Evaluator(host);
    expect(evaluator.evaluate(expression('ABS(INT(-RND()*10))+KEYDOWN(INKEY$())'))).toBe(4);
    expect(trace).toEqual(['random', 'readKey', 'keyDown:A']);
    expect(evaluator.evaluate(expression('ABS('.repeat(256) + '1' + ')'.repeat(256)))).toBe(1);
  });

  it('keeps type failures after argument effects and before later operands', () => {
    const {host, trace} = observedHost();
    const node = expression('ABS(INKEY$())+RND()', {line: 8, offset: 200});
    const error = failure(() => new Evaluator(host).evaluate(node));
    expect(error.diagnostic).toMatchObject({
      code: 'TYPE_MISMATCH',
      message: 'Expected a number',
      line: 8,
      column: 10,
      offset: 209,
    });
    expect(trace).toEqual(['readKey']);
  });

  it('preserves native whole-program versus runtime validation timing', () => {
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    const dead = parseProgram(
      '10 IF 1=2 THEN PRINT ABS() ELSE PRINT "kept"\n20 END\n30 PRINT INT()',
    );
    expect(basic.run(dead).status).toBe('halted');
    expect(output.join('')).toBe('kept\n');
    output.length = 0;
    const invalid = parseProgram('10 PRINT "before":PRINT ABS()');
    const error = failure(() => basic.run(invalid));
    expect(error.diagnostic.code).toBe('INVALID_ARGUMENT_COUNT');
    expect(output.join('')).toBe('before\n');
    expect(basic.run('10 PRINT ABS(-4)').status).toBe('halted');
    expect(output.join('')).toBe('before\n4\n');
  });

  it('retains future intrinsic spellings as native scalar and array names', () => {
    const output: string[] = [];
    const source =
      '10 DIM SQR(1),EXP(1),LEFT(1):SQR=2:SQR(1)=3:EXP=4:EXP(1)=5:LEFT=6:LEFT(1)=7:PI=8\n20 PRINT SQR;SQR(1);EXP;EXP(1);LEFT;LEFT(1);PI';
    const basic = new Basic({write: (text) => output.push(text)});
    basic.run(source);
    expect(output.join('')).toBe('2345678\n');
    const statement = parseLine('10 PRINT SQR(1);EXP;LEFT(0);PI')?.statement;
    if (statement?.type !== 'PrintStatement') throw Error('Expected PRINT');
    expect(statement.items.map((node) => node.type)).toEqual([
      'ArrayReference',
      'Variable',
      'ArrayReference',
      'Variable',
    ]);
  });

  it('keeps evaluator instances and reset independent of shared signatures', () => {
    const first = observedHost(),
      second = observedHost();
    const one = new Evaluator(first.host),
      two = new Evaluator(second.host);
    const node = expression('KEYDOWN(INKEY$())+RND()');
    expect(one.evaluate(node)).toBe(1.25);
    expect(second.trace).toEqual([]);
    one.reset();
    expect(two.evaluate(node)).toBe(1.25);
    expect(first.trace).toEqual(['readKey', 'keyDown:A', 'random']);
    expect(second.trace).toEqual(first.trace);
  });
});
