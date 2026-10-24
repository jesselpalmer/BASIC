import {BasicSyntaxError} from '../core/diagnostic.ts';
import {describe, it, expect, beforeEach} from 'bun:test';
import {jest} from 'bun:test';
import ExecProgram from './exec_program.ts';

describe('ExecProgram lifecycle', () => {
  let write: ReturnType<typeof jest.fn<(text: string) => void>>;
  let program: ExecProgram;

  beforeEach(() => {
    write = jest.fn();
    program = new ExecProgram({write});
  });

  it('retains validation history across session lines', () => {
    program.readLine('10 PRINT "first"');
    program.readLine('20 PRINT "second"');
    expect(() => program.readLine('10 PRINT "duplicate"')).toThrow('Duplicate line label 10');
    expect(write.mock.calls).toEqual([['first\n'], ['second\n']]);
    expect(program.status).toBe('error');
  });

  it('keeps independent sessions isolated', () => {
    program.readLine('10 PRINT "session one"');
    new ExecProgram({write}).readLine('10 PRINT "session two"');
    expect(write.mock.calls).toEqual([['session one\n'], ['session two\n']]);
  });

  it('END halts the run without executing subsequent statements', () => {
    const result = program.run('10 PRINT "before"\n20 END\n30 PRINT "after"');
    expect(result).toEqual({status: 'halted'});
    program.readLine('40 PRINT "still stopped"');
    expect(write.mock.calls).toEqual([['before\n']]);
  });

  it('starts each run with independent validation and completion state', () => {
    program.run('10 PRINT "first"\n20 END');
    program.run('10 PRINT "second"\n');
    expect(write.mock.calls).toEqual([['first\n'], ['second\n']]);
    expect(program.status).toBe('halted');
  });

  it('halts on an error and can be explicitly reset or rerun', () => {
    expect(() => program.run('10 INT "bad"\n20 PRINT "skipped"')).toThrow('Invalid number');
    expect(program.status).toBe('error');
    program.readLine('30 PRINT "also skipped"');
    expect(write).not.toHaveBeenCalled();
    program.reset();
    program.readLine('10 PRINT "recovered"');
    program.run('10 PRINT "rerun"');
    expect(write.mock.calls).toEqual([['recovered\n'], ['rerun\n']]);
  });

  it.each(['ABS', 'INT'])('stops on malformed %s input and recovers', (command) => {
    expect(() => program.run(`10 ${command} "12oops"\n20 PRINT "skipped"`)).toThrow(
      'Invalid number',
    );
    expect(write).not.toHaveBeenCalled();
    expect(program.status).toBe('error');
    program.readLine('30 PRINT "also skipped"');
    expect(write).not.toHaveBeenCalled();
    program.reset();
    program.readLine(`10 ${command} "-1.6"`);
    expect(write).toHaveBeenLastCalledWith(command === 'ABS' ? '1.6\n' : '-2\n');
    program.run('10 PRINT "new run"');
    expect(write).toHaveBeenLastCalledWith('new run\n');
    expect(program.status).toBe('halted');
  });

  it('finishes an empty program without host interaction', () => {
    expect(program.run('\n \r\n')).toEqual({status: 'halted'});
    expect(write).not.toHaveBeenCalled();
  });

  it('executes tokenized legacy commands with tabs, case, and doubled quotes', () => {
    program.run(
      [
        '\t010\tprint\t"MiXeD  ""Quote""\\n"  ',
        '20 rem "unfinished : @ <>',
        '30 iNt "-1.6"',
        '40 eNd',
        '50 PRINT "unreachable"',
      ].join('\r\n'),
    );
    expect(write.mock.calls).toEqual([['MiXeD  "Quote"\\n\n'], ['-2\n']]);
  });

  it('returns structured lexical diagnostics with original file positions', () => {
    const source = '\r\n10 REM comment\r\n\t20 PRINT "unfinished';
    let failure;
    try {
      program.run(source);
    } catch (error) {
      failure = error;
    }
    if (!(failure instanceof BasicSyntaxError)) throw failure;
    expect(failure.message).toBe('Line 20, column 11: Unterminated string');
    expect(failure.diagnostic).toEqual({
      code: 'UNTERMINATED_STRING',
      message: 'Unterminated string',
      label: 20,
      line: 3,
      column: 11,
      offset: source.indexOf('"'),
    });
    expect(write).not.toHaveBeenCalled();
    expect(program.status).toBe('error');
    program.run('20 PRINT "recovered"');
    expect(write).toHaveBeenCalledWith('recovered\n');
  });

  it('reports a malformed label by physical line and never runs its command', () => {
    expect(() => program.run('\n  10abc PRINT "must not run"')).toThrow(
      'Source line 2, column 3: Invalid line label "10abc"',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects multiple statements in one readLine call, even after REM', () => {
    expect(() => program.readLine('10 REM comment\n20 PRINT "lost"')).toThrow(
      'Line 20, column 1: Expected one numbered statement',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    '10 PRINT "first";"second"',
    '10 PRINT "first" "second"',
    '10 PRINT 1+2',
    '10 PRINT 12oops',
    '10 PRINT',
    '10 END "extra"',
    '10 CLS "extra"',
    '10 "PRINT" "bad"',
    '10',
    '10 UNKNOWN',
  ])('rejects unsupported or trailing syntax instead of discarding it: %s', (source) => {
    expect(() => program.run(source)).toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(program.status).toBe('error');
  });
});
