import {describe, expect, it, jest} from 'bun:test';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';
import type {Host, Program} from './types.ts';

function setup(overrides: Partial<Host> = {}) {
  const output: string[] = [];
  const clear = jest.fn();
  const basic = new Basic({write: (text) => output.push(text), clear, ...overrides});
  return {basic, output, clear};
}

function failure(action: () => unknown): BasicRuntimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    return error;
  }
  throw new Error('Expected a runtime failure');
}

describe('program statements', () => {
  it('runs in numeric label order with persistent typed variables', () => {
    const {basic, output} = setup();
    const result = basic.run(
      '40 END\n30 PRINT "Score: "; score; name$\n10 LET SCORE = 5\n20 LET NAME$ = "!"',
    );
    expect(output).toEqual(['Score: 5!\n']);
    expect(result).toMatchObject({
      status: 'halted',
      currentLocation: {label: 40},
      nextLocation: null,
      diagnostic: null,
    });
  });

  it('reassigns a variable from its previous value and executes built-ins', () => {
    const {basic, output} = setup({random: () => 0.41});
    basic.run(
      '10 LET A = 2\n20 LET a = A*5\n30 PRINT A; ":"; ABS(-3.14); ":"; INT(-1.6); ":"; INT(RND()*100)+1',
    );
    expect(output).toEqual(['10:3.14:-2:42\n']);
  });

  it('implements PRINT joining, newline suppression, blank output, and value spelling', () => {
    const {basic, output} = setup();
    basic.run(
      '10 PRINT "Hello, ";\n20 PRINT "world!"\n30 PRINT\n40 PRINT "";\n50 PRINT -0;" ";1/2;" ";"A"+"B"',
    );
    expect(output).toEqual(['Hello, ', 'world!\n', '\n', '', '0 0.5 AB\n']);
    expect(output.join('')).toBe('Hello, world!\n\n0 0.5 AB\n');
  });

  it('allows exponent display for finite results while retaining decimal-only source', () => {
    const {basic, output} = setup();
    basic.run('10 PRINT ' + '9'.repeat(30) + '*10');
    expect(output).toEqual([`${Number('9'.repeat(30)) * 10}\n`]);
    expect(() => basic.run('10 PRINT 1e3')).toThrow(BasicSyntaxError);
  });

  it('delegates CLS without resetting variables and leaves REM inert', () => {
    const {basic, output, clear} = setup();
    basic.run('10 LET A = 3\n20 CLS\n30 REM "unfinished RND()\n40 PRINT A\n50 REM');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(output).toEqual(['3\n']);
  });

  it('halts at END without evaluating later statements', () => {
    const random = jest.fn(() => 0.5);
    const {basic, output, clear} = setup({random});
    const result = basic.run('10 PRINT "before"\n20 END\n30 CLS\n40 PRINT MISSING + RND()');
    expect(output).toEqual(['before\n']);
    expect(clear).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'halted',
      currentLocation: {label: 20},
      nextLocation: null,
    });
    expect(basic.step()).toEqual(result);
    expect(basic.readLine('50 PRINT "still stopped"')).toEqual(result);
  });

  it.each(['', '\r\n \t\n'])(
    'finishes an empty program without interacting with the host',
    (source) => {
      const {basic, output, clear} = setup();
      expect(basic.run(source)).toEqual({
        status: 'halted',
        currentLocation: null,
        nextLocation: null,
        diagnostic: null,
      });
      expect(output).toEqual([]);
      expect(clear).not.toHaveBeenCalled();
    },
  );

  it('preserves whitespace, case, doubled quotes, tabs, and CRLF source', () => {
    const {basic, output} = setup();
    basic.run('\t010\tprint "MiXeD  ""Quote""\\n"  \r\n20 print int(-1.6)\r\n30 end');
    expect(output).toEqual(['MiXeD  "Quote"\\n\n', '-2\n']);
  });

  it('evaluates PRINT items left to right before writing the statement', () => {
    const events: string[] = [];
    let sample = 0;
    const {basic} = setup({
      random() {
        events.push('random');
        return ++sample / 10;
      },
      write(text) {
        events.push(text);
      },
    });
    basic.run('10 PRINT RND(); RND(); RND()');
    expect(events).toEqual(['random', 'random', 'random', '0.10.20.3\n']);
    events.length = 0;
    failure(() => basic.run('10 PRINT RND(); MISSING; RND()\n20 PRINT "skipped"'));
    expect(events).toEqual(['random']);
  });
});

describe('stepping, snapshots, and reruns', () => {
  it('prepares without executing, then steps exactly one statement at a time', () => {
    const {basic, output, clear} = setup();
    expect(basic.state).toEqual({
      status: 'ready',
      currentLocation: null,
      nextLocation: null,
      diagnostic: null,
    });
    const prepared = basic.reset(parseProgram('40 END\n10 LET A=3\n20 PRINT A\n30 CLS'));
    expect(prepared).toMatchObject({
      status: 'ready',
      currentLocation: null,
      nextLocation: {label: 10},
    });
    expect(output).toEqual([]);
    expect(clear).not.toHaveBeenCalled();
    expect(basic.step()).toMatchObject({
      status: 'running',
      currentLocation: {label: 10},
      nextLocation: {label: 20},
    });
    expect(output).toEqual([]);
    expect(basic.step()).toMatchObject({
      status: 'running',
      currentLocation: {label: 20},
      nextLocation: {label: 30},
    });
    expect(output).toEqual(['3\n']);
    expect(basic.step()).toMatchObject({
      status: 'running',
      currentLocation: {label: 30},
      nextLocation: {label: 40},
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(basic.step()).toMatchObject({
      status: 'halted',
      currentLocation: {label: 40},
      nextLocation: null,
    });
    expect(prepared.status).toBe('ready');
  });

  it('halts after the last statement without requiring an extra step', () => {
    const {basic, output} = setup();
    basic.reset('10 PRINT "last"');
    const result = basic.step();
    expect(result).toMatchObject({
      status: 'halted',
      currentLocation: {label: 10},
      nextLocation: null,
    });
    expect(basic.step()).toEqual(result);
    expect(output).toEqual(['last\n']);
  });

  it('shows the executing statement and pending successor inside a host callback', () => {
    const observed: [number | null, number | null][] = [];
    const basic = new Basic({
      write() {
        observed.push([
          basic.state.currentLocation?.label ?? null,
          basic.state.nextLocation?.label ?? null,
        ]);
      },
    });
    basic.run('10 PRINT 1\n20 PRINT 2');
    expect(observed).toEqual([
      [10, 20],
      [20, null],
    ]);
    expect(Object.isFrozen(basic.host)).toBe(true);
    expect(Reflect.set(basic, 'host', {})).toBe(false);
  });

  it('can step an initially empty runtime and reset it', () => {
    const basic = new Basic();
    expect(basic.step().status).toBe('halted');
    expect(basic.reset().status).toBe('ready');
    expect(basic.run().status).toBe('halted');
  });

  it('rewinds the loaded program, clears variables, and does not rewind randomness', () => {
    let calls = 0;
    const {basic, output} = setup({random: () => ++calls / 10});
    basic.run('10 LET A = RND()\n20 PRINT A');
    basic.run();
    basic.reset();
    expect(basic.state).toMatchObject({
      status: 'ready',
      currentLocation: null,
      nextLocation: {label: 10},
    });
    basic.step();
    basic.step();
    expect(output).toEqual(['0.1\n', '0.2\n', '0.3\n']);
    failure(() => basic.run('10 PRINT A'));
    expect(basic.state.diagnostic?.code).toBe('UNDEFINED_VARIABLE');
    basic.reset('10 PRINT A$');
    expect(failure(() => basic.step()).diagnostic.code).toBe('UNDEFINED_VARIABLE');
  });

  it('keeps separately stepped runtime instances isolated', () => {
    const first = setup();
    const second = setup();
    first.basic.reset('10 LET A = 1\n20 PRINT A');
    second.basic.reset('10 LET A = 2\n20 PRINT A');
    first.basic.step();
    second.basic.step();
    second.basic.step();
    first.basic.step();
    expect(first.output).toEqual(['1\n']);
    expect(second.output).toEqual(['2\n']);
    first.basic.reset();
    expect(second.basic.status).toBe('halted');
  });

  it('copies a mutable candidate before stepping and preserves its original source locations', () => {
    const candidate = structuredClone(parseProgram('20 PRINT A\r\n10 LET A = 3'));
    const {basic, output} = setup();
    const prepared = basic.reset(candidate);
    const first = candidate.lines[0].statement;
    if (first.type !== 'LetStatement' || first.expression.type !== 'NumberLiteral')
      throw new Error('Expected a numeric assignment');
    Reflect.set(first.expression, 'value', 9);
    Reflect.set(candidate.lines, '1', candidate.lines[0]);
    expect(Object.isFrozen(candidate)).toBe(false);
    expect(prepared.nextLocation).toMatchObject({
      label: 10,
      start: {line: 2, column: 4, offset: 15},
    });
    basic.step();
    basic.step();
    expect(output).toEqual(['3\n']);
    expect(basic.state.currentLocation).toMatchObject({
      label: 20,
      start: {line: 1, column: 4, offset: 3},
    });
  });

  it('exposes frozen results, positions, and diagnostics without mutable execution state', () => {
    const {basic} = setup();
    const ready = basic.reset('10 PRINT 1 / 0');
    expect(Object.isFrozen(ready)).toBe(true);
    expect(Object.isFrozen(ready.nextLocation)).toBe(true);
    expect(Object.isFrozen(ready.nextLocation?.start)).toBe(true);
    expect(Reflect.set(ready, 'status', 'halted')).toBe(false);
    expect(Reflect.set(ready.nextLocation!.start, 'line', 100)).toBe(false);
    const error = failure(() => basic.step());
    const failed = basic.state;
    expect(Object.isFrozen(failed.diagnostic)).toBe(true);
    Reflect.set(error.diagnostic, 'message', 'mutated');
    expect(failed.diagnostic?.message).toBe('Cannot divide by zero');
    expect(ready.status).toBe('ready');
    expect(basic.status).toBe('error');
  });

  it.each(['reset', 'run', 'step', 'readLine'] as const)(
    'rejects reentrant %s from a host callback',
    (method) => {
      const attempts: string[] = [];
      const basic = new Basic({
        write() {
          try {
            if (method === 'readLine') basic.readLine('90 PRINT "nested"');
            else basic[method]();
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            attempts.push(error.message);
          }
        },
      });
      expect(basic.run('10 PRINT "outer"\n20 END').status).toBe('halted');
      expect(attempts).toEqual(['Cannot change execution during a statement']);
      expect(basic.state.currentLocation?.label).toBe(20);
    },
  );
});

describe('runtime and preflight failures', () => {
  it.each([
    ['10 PRINT "must not print"\n20 END\n30 PRINT "bad', 'Unterminated string'],
    ['010 PRINT "must not print"\n10 END', 'Duplicate line label 10'],
    ['10 PRINT "must not print"\n20 PRINT 12oops', 'Invalid decimal literal'],
  ])('validates the complete source before any effects: %s', (source, message) => {
    const {basic, output} = setup();
    expect(() => basic.run(source)).toThrow(message);
    expect(output).toEqual([]);
    expect(basic.state).toMatchObject({status: 'error', currentLocation: null, nextLocation: null});
    expect(basic.state.diagnostic).not.toBeNull();
    expect(basic.step()).toEqual(basic.state);
    expect(basic.run('10 PRINT "recovered"').status).toBe('halted');
    expect(output).toEqual(['recovered\n']);
  });

  it('reports original runtime error positions and stops all later effects', () => {
    const {basic, output, clear} = setup();
    const source = '40 CLS\r\n20 PRINT 1 / 0\r\n10 PRINT "before"';
    const error = failure(() => basic.run(source));
    expect(error.message).toBe('Line 20, column 12: Cannot divide by zero');
    expect(error.diagnostic).toMatchObject({
      code: 'DIVISION_BY_ZERO',
      label: 20,
      line: 2,
      column: 12,
      offset: 19,
    });
    expect(output).toEqual(['before\n']);
    expect(clear).not.toHaveBeenCalled();
    expect(basic.state).toMatchObject({
      status: 'error',
      currentLocation: {label: 20},
      nextLocation: null,
      diagnostic: error.diagnostic,
    });
    expect(basic.step().status).toBe('error');
    expect(output).toEqual(['before\n']);
    basic.run('10 PRINT "new run"');
    expect(basic.state.diagnostic).toBeNull();
    expect(output).toEqual(['before\n', 'new run\n']);
  });

  it.each([
    '10 LET A = "bad"',
    '10 LET A$ = 1',
    '10 PRINT MISSING',
    '10 PRINT ABS("12oops")',
    '10 PRINT RND(1)',
  ])('uses source-located evaluator errors: %s', (source) => {
    const {basic, output} = setup();
    expect(failure(() => basic.run(source)).diagnostic.label).toBe(10);
    expect(basic.status).toBe('error');
    expect(output).toEqual([]);
  });

  it.each(['write', 'clear'] as const)(
    'locates host %s errors and preserves their cause',
    (callback) => {
      const cause = new Error('underlying host failure');
      const {basic, output} = setup({
        [callback]: () => {
          throw cause;
        },
      });
      const source =
        callback === 'write' ? '10 PRINT "failed"\n20 END' : '10 CLS\n20 PRINT "skipped"';
      const error = failure(() => basic.run(source));
      expect(error.cause).toBe(cause);
      expect(error.diagnostic).toMatchObject({code: 'HOST_ERROR', label: 10, column: 4});
      expect(basic.state.diagnostic).toEqual(error.diagnostic);
      expect(output).toEqual([]);
      expect(basic.step().status).toBe('error');
    },
  );

  it('supports reset and rerun after host failure without changing the host', () => {
    const output: string[] = [];
    let broken = true;
    const basic = new Basic({
      write(text) {
        if (broken) throw new Error('failed');
        output.push(text);
      },
    });
    failure(() => basic.run('10 PRINT "ok"'));
    broken = false;
    basic.reset();
    expect(basic.step().status).toBe('halted');
    basic.run();
    expect(output).toEqual(['ok\n', 'ok\n']);
  });

  it('retains the previous snapshot after a failed candidate and requires explicit reset to execute it', () => {
    const {basic, output} = setup();
    basic.reset('10 PRINT "retained"');
    expect(() => basic.reset('10 PRINT "bad')).toThrow(BasicSyntaxError);
    expect(basic.step().status).toBe('error');
    expect(output).toEqual([]);
    basic.reset();
    basic.step();
    expect(output).toEqual(['retained\n']);
    expect(() => basic.reset({type: 'Program', lines: [null]} as unknown as Program)).toThrow(
      TypeError,
    );
    expect(basic.state).toMatchObject({status: 'error', diagnostic: null});
  });

  it.each([
    '10 ABS "-3.14"',
    '10 INT "-1.6"',
    '10 PRINT "a" "b"',
    '10 PRINT ;1',
    '10 END 1',
    '10 CLS 1',
    '10',
    '10 UNKNOWN',
  ])('rejects legacy or unsupported syntax: %s', (source) => {
    const {basic, output} = setup();
    expect(() => basic.run(source)).toThrow(BasicSyntaxError);
    expect(output).toEqual([]);
  });
});

describe('transitional immediate entries', () => {
  it('shares the new expression and statement implementation across entries', () => {
    const {basic, output} = setup();
    basic.readLine('20 LET A = 2');
    basic.readLine('10 PRINT A*3;');
    expect(basic.state).toMatchObject({
      status: 'running',
      currentLocation: {label: 10},
      nextLocation: null,
    });
    expect(output).toEqual(['6']);
    expect(() => basic.readLine('020 PRINT "duplicate"')).toThrow('Duplicate line label 20');
    basic.readLine('30 PRINT "skipped"');
    expect(output).toEqual(['6']);
    basic.reset();
    basic.readLine('20 PRINT "reset"');
    basic.readLine('30 END');
    expect(basic.status).toBe('halted');
    expect(basic.step().status).toBe('halted');
    expect(output).toEqual(['6', 'reset\n']);
  });

  it('does not reserve a label on parse failure and leaves blank input inert', () => {
    const {basic, output} = setup();
    expect(basic.readLine(' \t').status).toBe('ready');
    expect(() => basic.readLine('10 PRINT "bad')).toThrow(BasicSyntaxError);
    basic.reset();
    basic.readLine('10 PRINT "fixed"');
    expect(basic.readLine(' ').status).toBe('running');
    expect(output).toEqual(['fixed\n']);
  });

  it('rejects multiple statements in one entry without effects', () => {
    const {basic, output} = setup();
    expect(() => basic.readLine('10 REM comment\n20 PRINT "lost"')).toThrow(
      'Expected one numbered statement',
    );
    expect(output).toEqual([]);
  });

  it('rejects mixing immediate entries with program steps until reset', () => {
    const {basic, output} = setup();
    basic.reset('10 PRINT "first"\n20 PRINT "next"');
    basic.step();
    expect(() => basic.readLine('30 PRINT "mixed"')).toThrow('Call reset before mixing');
    basic.step();
    basic.reset();
    basic.readLine('10 PRINT "immediate"');
    expect(() => basic.step()).toThrow('Call reset before stepping');
    expect(output).toEqual(['first\n', 'next\n', 'immediate\n']);
  });

  it('retains physical coordinates supplied for an immediate fragment', () => {
    const basic = new Basic();
    const error = failure(() => basic.readLine('20 PRINT MISSING', {line: 9, offset: 200}));
    expect(error.diagnostic).toMatchObject({label: 20, line: 9, column: 10, offset: 209});
  });
});
