import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  Evaluator,
  parseLine,
  parseProgram,
} from '../index.ts';
import {tokenize} from '../parser/tokenizer.ts';
import {readFileSync} from 'node:fs';

function expression(source: string) {
  const statement = parseLine(`10 PRINT ${source}`)!.statement;
  if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
  return statement.items[0];
}

function evaluate(source: string) {
  return new Evaluator().evaluate(expression(source));
}

function diagnostic(source: string) {
  try {
    parseProgram(source);
  } catch (error) {
    if (!(error instanceof BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
  throw new Error('Expected syntax failure');
}

const fixture = readFileSync(
  new URL('../../scripts/package/fixtures/numeric/formulas.bas', import.meta.url),
  'utf8',
);
const expected = 'constants=0.001:0.000884361\nheight=16\ndistance=13\npowers=-4:64:0.0625\n';

describe('scientific literals and powers', () => {
  it.each([
    ['1E-3', 0.001],
    ['8.84361E-04', 0.000884361],
    ['.5e+2', 50],
    ['1.e2', 100],
    ['01.20e0', 1.2],
    ['5e-324', Number.MIN_VALUE],
    ['1e-9999', 0],
    ['0e9999', 0],
    ['1e2+3', 103],
    ['1e-2-3', -2.99],
  ] as const)('evaluates the complete literal %s', (source, value) => {
    expect(evaluate(source)).toBe(value);
  });

  it('retains scientific spelling, label rules and physical coordinates', () => {
    const source = '\t20 PRINT 08.84361e-04^2';
    const tokens = tokenize(source, {line: 7, offset: 100});
    expect(tokens[2]).toMatchObject({
      type: 'NUMBER',
      value: 0.000884361,
      raw: '08.84361e-04',
      start: {line: 7, column: 11, offset: 110},
      end: {line: 7, column: 23, offset: 122},
    });
    const node = parseLine(source, {line: 7, offset: 100})!.statement;
    expect(node).toMatchObject({
      items: [
        {
          type: 'BinaryExpression',
          operator: '^',
          operatorLocation: {start: {line: 7, column: 23, offset: 122}},
        },
      ],
    });
    for (const invalid of [
      '1e1 END',
      '10 GOTO 2e1\n20 END',
      '10 IF 1=1 THEN 2e1\n20 END',
      '10 DIM A(1e1)',
    ]) {
      expect(() => parseProgram(invalid)).toThrow(BasicSyntaxError);
    }
  });

  it.each([
    '1e',
    '1e+',
    '1e-',
    '1E--2',
    '1e+-2',
    '1e2e3',
    '1e2.3',
    '1e2oops',
    '12E2$',
    '1e309',
    '1.2.3E4',
    '1d2',
  ])('rejects malformed/nonfinite whole words: %s', (source) => {
    expect(diagnostic(`10 PRINT ${source}`)).toMatchObject({
      code: 'INVALID_NUMBER',
      label: 10,
      line: 1,
      column: 10,
    });
  });

  it.each([
    ['-2^2', -4],
    ['(-2)^2', 4],
    ['2^3^2', 64],
    ['2^(3^2)', 512],
    ['2^-2^2', 0.0625],
    ['-2^-2^2', -0.0625],
    ['2^--2', 4],
    ['2^3^-2', 0.015625],
    ['2^(-2^2)', 0.0625],
    ['-2^2*3+5', -7],
    ['2*3^2+1', 19],
    ['4^.5', 2],
    ['(-2)^-3', -0.125],
    ['0^0', 1],
    ['0^2', 0],
    ['2^0', 1],
    ['2^-1074', Number.MIN_VALUE],
    ['2^-1075', 0],
    ['(-1)^1e300', 1],
    ['1^1e300', 1],
  ] as const)('uses the documented grouping: %s', (source, value) => {
    expect(evaluate(source)).toBe(value);
  });

  it.each([
    ['(-2)^.5', 'NUMERIC_DOMAIN'],
    ['0^-1', 'DIVISION_BY_ZERO'],
    ['(-0)^-2', 'DIVISION_BY_ZERO'],
    ['1e308^2', 'NON_FINITE_NUMBER'],
    ['2^1e300', 'NON_FINITE_NUMBER'],
    ['"2"^2', 'TYPE_MISMATCH'],
    ['2^"2"', 'TYPE_MISMATCH'],
  ])('reports a located failure for %s', (source, code) => {
    try {
      evaluate(source);
      throw new Error('Expected runtime failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BasicRuntimeError);
      if (!(error instanceof BasicRuntimeError)) throw error;
      expect(error.diagnostic).toMatchObject({code, label: 10, column: 10 + source.indexOf('^')});
    }
  });

  it.each(['2^', '^2', '2^^2', '2**2', '2^*2', '2^/2'])('rejects malformed powers %s', (source) => {
    expect(() => expression(source)).toThrow(BasicSyntaxError);
  });

  it('bounds nesting while parsing and evaluating long flat power chains iteratively', () => {
    expect(evaluate(Array(6000).fill('1').join('^'))).toBe(1);
    expect(evaluate(`2^${'-'.repeat(256)}2`)).toBe(4);
    expect(diagnostic(`10 PRINT 2^${'-'.repeat(257)}2`)).toMatchObject({
      code: 'EXPRESSION_TOO_DEEP',
    });
    expect(diagnostic(`10 PRINT ${'('.repeat(257)}2^2${')'.repeat(257)}`)).toMatchObject({
      code: 'EXPRESSION_TOO_DEEP',
    });
  });

  it('evaluates operands once from left to right and propagates failures before later effects', () => {
    const values = [0.5, 0.25, 0.5];
    const calls: number[] = [];
    const evaluator = new Evaluator({
      random() {
        const n = values.shift()!;
        calls.push(n);
        return n;
      },
    });
    expect(evaluator.evaluate(expression('(RND()*4)^(RND()*8)^(RND()*4)'))).toBe(16);
    expect(calls).toEqual([0.5, 0.25, 0.5]);
    expect(() => evaluator.evaluate(expression('(-2)^.5^RND()'))).toThrow(BasicRuntimeError);
    expect(calls).toHaveLength(3);
  });

  it('keeps numeric names and undeclared errors unchanged', () => {
    const output: string[] = [];
    new Basic({write: (text) => output.push(text)}).run(
      '10 DIM SQR(1)\n20 SQR=2\n30 SQR(1)=3\n40 EXP=4\n50 PRINT SQR;SQR(1);EXP',
    );
    expect(output.join('')).toBe('234\n');
    expect(() => evaluate('EXP')).toThrow('Undefined variable EXP');
    expect(() => evaluate('RND(0)')).toThrow('RND expects 0');
  });

  it('executes extracted corpus formulas through run, step and rerun', () => {
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    expect(basic.run(fixture).status).toBe('halted');
    expect(output.join('')).toBe(expected);
    output.length = 0;
    basic.reset();
    while (basic.status !== 'halted') basic.step();
    expect(output.join('')).toBe(expected);
    output.length = 0;
    expect(basic.run().status).toBe('halted');
    expect(output.join('')).toBe(expected);
  });

  it('checks INPUT science/retry, async arithmetic, atomic output and recovery', async () => {
    const answers = ['1e+', '-2e1'];
    const output: string[] = [];
    const basic = new Basic({
      write: (text) => output.push(text),
      readLine: () => Promise.resolve(answers.shift() ?? null),
    });
    await basic.runAsync('10 INPUT N\n20 PRINT N^2');
    expect(output.join('')).toBe('Invalid number; please enter a finite decimal.\n400\n');
    output.length = 0;
    const error = await basic
      .runAsync('10 PRINT "partial";2^1e300')
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(output).toEqual([]);
    expect(basic.state.diagnostic?.code).toBe('NON_FINITE_NUMBER');
    expect(basic.run('10 PRINT 4^.5').status).toBe('halted');
    expect(output.join('')).toBe('2\n');
  });
});
