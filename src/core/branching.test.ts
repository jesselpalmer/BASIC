import {describe, expect, it, jest} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  Evaluator,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {Comparison, ParsedLine, RunStatus} from './types.ts';

function line(source: string): ParsedLine {
  const result = parseLine(source);
  if (!result) throw new Error('Expected a parsed line');
  return result;
}

function condition(source: string): Comparison {
  const statement = line(`10 IF ${source} THEN 20`).statement;
  if (statement.type !== 'IfStatement') throw new Error('Expected IF');
  return statement.condition;
}

function setup() {
  const output: string[] = [];
  const basic = new Basic({write: (text) => output.push(text)});
  return {basic, output};
}

describe('comparison evaluation and branching', () => {
  it.each<[string, boolean]>([
    ['1=1', true],
    ['1=2', false],
    ['1<>2', true],
    ['1<>1', false],
    ['1<2', true],
    ['2<2', false],
    ['2<1', false],
    ['1<=2', true],
    ['2<=2', true],
    ['3<=2', false],
    ['2>1', true],
    ['2>2', false],
    ['1>2', false],
    ['2>=1', true],
    ['2>=2', true],
    ['1>=2', false],
    ['-0=0', true],
    ['-1.5 < -.5', true],
    ['(1+2)*3 = ABS(-9)', true],
    ['"a"="a"', true],
    ['"a"="A"', false],
    ['"a"<>"A"', true],
    ['"a"<>"a"', false],
    ['""=""', true],
    ['"a"+"b" = "ab"', true],
    ['"She said ""Hi""" = "She said ""Hi"""', true],
  ])('branches or falls through for %s', (source, result) => {
    const {basic, output} = setup();
    basic.run(`10 IF ${source} THEN 40\n20 PRINT "false"\n30 GOTO 50\n40 PRINT "true"\n50 END`);
    expect(output).toEqual([result ? 'true\n' : 'false\n']);
    expect(basic.status).toBe('halted');
  });

  it('compares both operands left to right, without coercion or short-circuiting', () => {
    const samples = [0.1, 0.2];
    const random = jest.fn(() => samples.shift()!);
    const evaluator = new Evaluator({random});
    expect(evaluator.compare(condition('RND() > RND()'))).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
    expect(() => evaluator.compare(condition('1 / 0 = RND()'))).toThrow('Cannot divide by zero');
    expect(random).toHaveBeenCalledTimes(2);
  });

  it.each(['1="1"', '"1"=1', '"a"<"b"', '"a"<="b"', '"a">"b"', '"a">="b"'])(
    'guards comparison types in the standalone evaluator: %s',
    (source) => {
      let caught;
      try {
        new Evaluator().compare(condition(source));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(BasicRuntimeError);
      expect(caught).toMatchObject({diagnostic: {code: 'TYPE_MISMATCH', label: 10}});
    },
  );

  it('reads typed variables and preserves their string case', () => {
    const {basic, output} = setup();
    basic.run(
      '10 LET A=2\n20 LET NAME$="MiX"\n30 IF a*3=6 THEN 50\n40 END\n50 IF name$<>"mix" THEN 70\n60 END\n70 PRINT "matched"',
    );
    expect(output).toEqual(['matched\n']);
  });

  it('reports undefined variables and arithmetic failures when their comparison executes', () => {
    const {basic} = setup();
    expect(() => basic.run('10 IF UNKNOWN=1 THEN 20\n20 END')).toThrow(
      'Undefined variable UNKNOWN',
    );
    expect(basic.state.diagnostic?.code).toBe('UNDEFINED_VARIABLE');
    expect(() => basic.run('10 IF 1/0=1 THEN 20\n20 END')).toThrow('Cannot divide by zero');
    expect(basic.state.diagnostic?.code).toBe('DIVISION_BY_ZERO');
  });
});

describe('control flow and stepping', () => {
  it('takes forward and backward jumps independently of physical source ordering', () => {
    const {basic, output} = setup();
    basic.run('50 END\n40 IF N>0 THEN 20\n10 LET N=3\n30 LET N=N-1\n20 PRINT N');
    expect(output).toEqual(['3\n', '2\n', '1\n']);
    expect(basic.state.currentLocation?.label).toBe(50);
  });

  it('steps a jump to the first index and a self-jump without halting or running a hidden statement', () => {
    const {basic, output} = setup();
    basic.reset('10 PRINT "first"\n20 GOTO 10');
    basic.step();
    expect(basic.step()).toMatchObject({
      status: 'running',
      currentLocation: {label: 20},
      nextLocation: {label: 10},
    });
    expect(output).toEqual(['first\n']);
    basic.step();
    expect(output).toEqual(['first\n', 'first\n']);
    basic.reset('10 GOTO 10');
    for (let i = 0; i < 3; i++) {
      expect(basic.step()).toMatchObject({
        status: 'running',
        currentLocation: {label: 10},
        nextLocation: {label: 10},
      });
    }
    basic.cancel();
    expect(basic.status).toBe('halted');
  });

  it.each<[string, RunStatus, number | null]>([
    ['1=1', 'running', 10],
    ['1=2', 'halted', null],
  ])('handles a conditional jump on the last line: %s', (source, status, next) => {
    const {basic} = setup();
    basic.reset(`10 REM start\n20 IF ${source} THEN 10`);
    basic.step();
    expect(basic.step().status).toBe(status);
    expect(basic.state.nextLocation?.label ?? null).toBe(next);
  });

  it('normalizes leading-zero targets and skips statements without their effects', () => {
    const {basic, output} = setup();
    basic.run('10 GOTO 00030\n20 PRINT MISSING\n30 PRINT "hit"');
    expect(output).toEqual(['hit\n']);
  });

  it('rebuilds target resolution for replacement runs and keeps the prior map on failed validation', () => {
    const {basic, output} = setup();
    basic.reset('10 GOTO 30\n30 PRINT "retained"');
    expect(() => basic.reset('10 GOTO 999')).toThrow(BasicSyntaxError);
    expect(basic.step().status).toBe('error');
    basic.run();
    basic.run('100 GOTO 300\n200 PRINT "skip"\n300 PRINT "new"');
    expect(output).toEqual(['retained\n', 'new\n']);
  });

  it('does not retain mutable target or comparison references from a caller candidate', () => {
    const candidate = structuredClone(
      parseProgram('10 IF 1=1 THEN 30\n20 PRINT "skip"\n30 PRINT "kept"'),
    );
    const {basic, output} = setup();
    basic.reset(candidate);
    const statement = candidate.lines[0].statement;
    if (statement.type !== 'IfStatement') throw new Error('Expected IF');
    Reflect.set(statement.target, 'value', 20);
    Reflect.set(statement.condition, 'operator', '<>');
    basic.step();
    expect(basic.state.nextLocation?.label).toBe(30);
    basic.step();
    expect(output).toEqual(['kept\n']);
    expect(Object.isFrozen(candidate)).toBe(false);
  });

  it.each(['10 GOTO 10', '10 IF 1=2 THEN 10'])(
    'rejects jumps in transitional immediate entries: %s',
    async (source) => {
      const {basic, output} = setup();
      expect(() => basic.readLine(source)).toThrow('require a complete program');
      expect(basic.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
      basic.reset();
      const error: unknown = await basic.readLineAsync(source).catch((error: unknown) => error);
      expect(error).toMatchObject({diagnostic: {code: 'PROGRAM_REQUIRED'}});
      expect(output).toEqual([]);
    },
  );
});

describe('branch parsing and complete-program checks', () => {
  it('retains comparison/target spans and literal spelling across CRLF and numeric sorting', () => {
    const source = '90 END\r\n\t20 IF (A+1) <= 2 THEN 00090';
    const statement = parseProgram(source).lines[0].statement;
    if (statement.type !== 'IfStatement') throw new Error('Expected IF');
    expect(statement.target).toMatchObject({
      type: 'NumberLiteral',
      value: 90,
      raw: '00090',
      location: {label: 20, start: {line: 2, column: 24, offset: 31}},
    });
    expect(statement.condition).toMatchObject({
      type: 'Comparison',
      operator: '<=',
      operatorLocation: {start: {line: 2, column: 14, offset: 21}},
      left: {type: 'GroupExpression'},
      right: {type: 'NumberLiteral', value: 2},
    });
    expect(Object.isFrozen(statement.condition.operatorLocation.start)).toBe(true);
  });

  it('allows unresolved single-line edits but validates every target in a complete candidate', () => {
    const edit = line('10 GOTO 30');
    const candidate = structuredClone([edit]);
    expect(() => validateProgram(candidate)).toThrow('No line label 30');
    expect(Object.isFrozen(candidate)).toBe(false);
    const program = validateProgram([line('30 END'), ...candidate]);
    expect(program.lines.map(({label}) => label)).toEqual([10, 30]);
    expect(line('10 IF A$=1 THEN 999').statement.type).toBe('IfStatement');
  });

  it.each(['10 GOTO 999', '10 IF 1=2 THEN 999'])(
    'rejects missing targets even when unreachable: %s',
    (source) => {
      const {basic, output} = setup();
      expect(() => basic.run(`1 PRINT "must not print"\n2 END\n${source}\n1000 END`)).toThrow(
        'No line label 999',
      );
      expect(output).toEqual([]);
      expect(basic.state).toMatchObject({
        status: 'error',
        currentLocation: null,
        nextLocation: null,
        diagnostic: {code: 'MISSING_TARGET', label: 10},
      });
    },
  );

  it('points a missing-target diagnostic at the original literal', () => {
    const {basic} = setup();
    const source = '30 END\r\n10 PRINT "no"\r\n20 IF 1=2 THEN 999';
    expect(() => basic.run(source)).toThrow('Line 20, column 16: No line label 999');
    expect(basic.state.diagnostic).toMatchObject({
      code: 'MISSING_TARGET',
      label: 20,
      line: 3,
      column: 16,
      offset: source.indexOf('999'),
    });
  });

  it.each([
    '1="1"',
    '"1"<>1',
    'A$=N',
    '("a"+"b")=3',
    '(1+2)="3"',
    'ABS(-1)="1"',
    '+1="1"',
    '2-1="1"',
    '"a"<"b"',
    '"a"<="b"',
    '"a">"b"',
    '"a">="b"',
  ])('rejects statically known comparison type errors before effects: %s', (source) => {
    const write = jest.fn();
    const random = jest.fn(() => 0.5);
    const basic = new Basic({write, random});
    expect(() => basic.run(`10 PRINT "must not print"\n20 END\n30 IF ${source} THEN 20`)).toThrow(
      BasicSyntaxError,
    );
    expect(basic.state.diagnostic).toMatchObject({code: 'TYPE_MISMATCH', label: 30});
    expect(write).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('never evaluates a random call or arithmetic while validating', () => {
    const random = jest.fn(() => 0.5);
    const basic = new Basic({random});
    expect(() => basic.run('10 IF RND()="bad" THEN 10')).toThrow(BasicSyntaxError);
    expect(random).not.toHaveBeenCalled();
    expect(() => parseProgram('10 END\n20 IF (1/0)=RND() THEN 10')).not.toThrow();
    expect(() => parseProgram('10 END\n20 IF "a"+1=0 THEN 10')).not.toThrow();
    expect(() => parseProgram('10 END\n20 IF 0=1+"a" THEN 10')).not.toThrow();
    expect(() => basic.run('10 IF "a"+1=0 THEN 20\n20 END')).toThrow(BasicRuntimeError);
    expect(random).not.toHaveBeenCalled();
  });

  it('infers comparison types iteratively for long flat expressions', () => {
    const sum = Array(6000).fill('1').join('+');
    expect(parseProgram(`10 IF ${sum}=6000 THEN 20\n20 END`).lines).toHaveLength(2);
  });

  it.each([
    '10 GOTO',
    '10 GOTO 0',
    '10 GOTO 65536',
    '10 GOTO -10',
    '10 GOTO +10',
    '10 GOTO 20.0',
    '10 GOTO 20.',
    '10 GOTO .5',
    '10 GOTO 1e2',
    '10 GOTO "20"',
    '10 GOTO N',
    '10 GOTO (20)',
    '10 GOTO 20+1',
    '10 IF 1=1 THEN 0',
  ])('rejects non-literal/out-of-range targets: %s', (source) => {
    expect(() => line(source)).toThrow(BasicSyntaxError);
  });

  it.each([
    '10 IF 1 THEN 20',
    '10 IF 1',
    '10 IF 1=1',
    '10 IF 1=1 THEN',
    '10 IF 1=1 THEN PRINT "x"',
    '10 IF 1=1 THEN 20 ELSE 30',
    '10 IF 1<2<3 THEN 20',
    '10 IF (1=1) THEN 20',
    '10 IF 1=1 AND 2=2 THEN 20',
    '10 IF 1=1 OR 2=2 THEN 20',
    '10 IF NOT 1=1 THEN 20',
    '10 IF 1==1 THEN 20',
    '10 IF 1!=2 THEN 20',
    '10 PRINT 1=1',
    '10 LET A = 1<2',
  ])('rejects unsupported comparison/control syntax: %s', (source) => {
    expect(() => line(source)).toThrow(BasicSyntaxError);
  });
});
