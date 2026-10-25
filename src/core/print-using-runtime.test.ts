import {describe, expect, it} from 'bun:test';
import {Basic, BasicRuntimeError, BasicSyntaxError} from '../index.ts';

function failure(basic: Basic, source: string, code: string): BasicRuntimeError {
  try {
    basic.run(source);
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error;
  }
  throw new Error('Expected format failure');
}

describe('PRINT USING execution', () => {
  it('bounds sync and async immediate lists before any host effect and permits recovery', async () => {
    let draws = 0;
    const writes: string[] = [];
    const basic = new Basic({
      write: (text) => writes.push(text),
      random: () => {
        draws++;
        return 0.5;
      },
    });
    const source = '10 PRINT USING "#",' + Array(4097).fill('RND()').join(',');
    expect(() => basic.readLine(source)).toThrow(BasicSyntaxError);
    expect(basic.state.diagnostic?.code).toBe('FORMAT_LIMIT');
    expect(draws).toBe(0);
    expect(writes).toEqual([]);
    basic.reset();
    const error = await basic.readLineAsync(source).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(BasicSyntaxError);
    expect(basic.state.diagnostic?.code).toBe('FORMAT_LIMIT');
    expect(draws).toBe(0);
    expect(writes).toEqual([]);
    basic.reset();
    basic.readLine('10 PRINT USING "##",2');
    await basic.readLineAsync('20 PRINT USING "##",3');
    expect(writes).toEqual([' 2\n', ' 3\n']);
  });
  it('evaluates template then values in order and writes the whole result once', () => {
    const trace: string[] = [];
    const draws = [0.1, 0.2];
    const basic = new Basic({
      readKey: () => {
        trace.push('format');
        return 'A';
      },
      random: () => {
        trace.push('value');
        return draws.shift()!;
      },
      write: (text) => trace.push(text),
    });
    basic.run('10 PRINT USING INKEY$()+"# #",INT(RND()*10),INT(RND()*10);\n20 PRINT "done"');
    expect(trace).toEqual(['format', 'value', 'value', 'A1 2', 'done\n']);
    expect(draws).toEqual([]);
  });

  it.each([
    ['10 PRINT USING "##.##",1', 'UNSUPPORTED_FORMAT'],
    ['10 PRINT USING "##",1,2', 'FORMAT_VALUE_COUNT'],
    ['10 PRINT USING "## ##",1', 'FORMAT_VALUE_COUNT'],
    ['10 PRINT USING "#",10', 'FORMAT_OVERFLOW'],
    ['10 PRINT USING "#",.5', 'UNSUPPORTED_FORMAT_VALUE'],
    ['10 PRINT USING "#","1"', 'TYPE_MISMATCH'],
  ])('emits no partial output and recovers: %s', (source, code) => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)});
    const error = failure(basic, source, code);
    expect(error.diagnostic).toMatchObject({label: 10, column: 16});
    expect(basic.state.diagnostic).toEqual(error.diagnostic);
    expect(basic.status).toBe('error');
    expect(basic.step().status).toBe('error');
    expect(writes).toEqual([]);
    basic.run('10 PRINT USING "##",4');
    expect(writes).toEqual([' 4\n']);
  });

  it('retains consumed item effects and skips later values after expression failure', () => {
    let draws = 0;
    const writes: string[] = [];
    const basic = new Basic({
      write: (text) => writes.push(text),
      random: () => {
        draws++;
        return 0.5;
      },
    });
    failure(basic, '10 PRINT USING "# # #",INT(RND()*10),1/0,INT(RND()*10)', 'DIVISION_BY_ZERO');
    expect(draws).toBe(1);
    expect(writes).toEqual([]);
    failure(basic, '10 PRINT USING "##.##",RND()', 'UNSUPPORTED_FORMAT');
    expect(draws).toBe(2);
    expect(writes).toEqual([]);
  });

  it('rejects static format candidates before effects and retains the previous program', () => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)});
    basic.reset('10 PRINT USING "##",7');
    expect(() => basic.run('1 PRINT "must not run"\n10 PRINT USING 1,2')).toThrow(BasicSyntaxError);
    expect(writes).toEqual([]);
    basic.run();
    expect(writes).toEqual([' 7\n']);
  });

  it('uses existing host error cause, source location and reentrancy protection', () => {
    const cause = new Error('writer failed');
    const writes: string[] = [];
    const basic = new Basic({
      write: (text) => {
        writes.push(text);
        expect(() => basic.reset()).toThrow('during a statement');
        throw cause;
      },
    });
    const error = failure(basic, '10 PRINT USING "##",2', 'HOST_ERROR');
    expect(error.cause).toBe(cause);
    expect(error.diagnostic.column).toBe(4);
    expect(writes).toEqual([' 2\n']);
  });

  it('counts formatting as one statement and retains the complete prior write at a budget boundary', async () => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)});
    const error = await basic
      .runAsync('10 PRINT USING "## ##",1,2\n20 PRINT "later"', {instructionLimit: 1})
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw new Error('Expected budget error');
    expect(error.diagnostic).toMatchObject({code: 'INSTRUCTION_LIMIT', label: 20});
    expect(writes).toEqual([' 1  2\n']);
    basic.run();
    expect(writes).toEqual([' 1  2\n', ' 1  2\n', 'later\n']);
  });
});
