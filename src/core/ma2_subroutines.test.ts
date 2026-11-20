import {describe, expect, test} from 'bun:test';
import reference from '../../docs/ma2-subroutines-reference.json';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;

describe('selected MA2 literal GOSUB and RETURN', () => {
  for (const probe of reference.probes.filter(
    ({name}) => name !== 'NOCLL' && !name.startsWith('UN'),
  )) {
    test(`matches both archives for ${probe.name} on fresh runs`, () => {
      let output = '';
      const basic = new Basic({write: (text) => (output += text)}, options);
      basic.run(probe.source.join('\n'));
      expect(output).toBe(probe.output);
      output = '';
      basic.run();
      expect(output).toBe(probe.output);
    });
  }

  test('gates unseen-header NEXT without applying a guessed scalar transition', () => {
    for (const probe of reference.probes.filter(({name}) => name.startsWith('UN'))) {
      const basic = new Basic({}, options);
      try {
        basic.run(probe.source.join('\n'));
        throw new Error('Expected unsupported unseen-header state');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicRuntimeError);
        if (!(error instanceof BasicRuntimeError)) throw error;
        expect(error.diagnostic).toMatchObject({code: 'UNSUPPORTED_MA2_LOOP_STATE', label: 120});
      }
      const initial =
        probe.name === 'UNSETN'
          ? -5
          : ['UNSET5', 'UNEXP1', 'UNPOST', 'UNRES'].includes(probe.name)
            ? 5
            : 0;
      expect(basic.variables.find(({name}) => name === 'I')?.value ?? 0).toBe(initial);
      expect(basic.run('10 FOR I=1 TO 2:NEXT I:END').status).toBe('halted');
    }
  });

  test('returns to a physical same-line successor and steps each call boundary', () => {
    const source = '100 PRINT "SUB":RETURN\r\n10 GOSUB 100:PRINT "DONE":END';
    let output = '';
    const basic = new Basic({write: (text) => (output += text)}, options);
    const program = parseProgram(source, options);
    expect(program.source).toBe(source);
    basic.reset(program);
    expect(basic.step().nextLocation).toMatchObject({label: 100, start: {line: 1, column: 5}});
    expect(basic.step().nextLocation).toMatchObject({label: 100, start: {line: 1, column: 17}});
    expect(basic.step().nextLocation).toMatchObject({label: 10, start: {line: 2, column: 14}});
    expect(basic.step().nextLocation).toMatchObject({label: 10, start: {line: 2, column: 27}});
    expect(basic.step().status).toBe('halted');
    expect(output).toBe('SUB\nDONE\n');
  });

  test('locates RETURN without GOSUB and bounds recursive calls', () => {
    const basic = new Basic({}, options);
    for (const [source, code, label] of [
      ['10 RETURN', 'RETURN_WITHOUT_GOSUB', 10],
      ['10 GOSUB 100:END\n100 GOSUB 100:RETURN', 'CALL_STACK_LIMIT', 100],
    ] as const) {
      try {
        basic.run(source);
        throw new Error('Expected failure');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicRuntimeError);
        if (!(error instanceof BasicRuntimeError)) throw error;
        expect(error.diagnostic).toMatchObject({code, label});
      }
      expect(basic.run('10 GOSUB 100:END\n100 RETURN').status).toBe('halted');
    }
  });

  test('checks dead missing/malformed calls before replacing a selected source', () => {
    let output = '';
    const basic = new Basic({write: (text) => (output += text)}, options);
    basic.run('10 GOSUB 100:PRINT "OLD":END\n100 RETURN');
    output = '';
    for (const source of [
      '10 PRINT "EARLY":END\n20 GOSUB 200',
      '10 PRINT "EARLY":END\n20 GOSUB N',
      '10 PRINT "EARLY":END\n20 RETURN 100',
      '10 PRINT "EARLY":END\n20 GOSUB 100+1\n100 RETURN',
    ]) {
      expect(() => basic.run(source)).toThrow(BasicSyntaxError);
      expect(output).toBe('');
    }
    basic.run();
    expect(output).toBe('OLD\n');
  });

  test('shares scalar and string-array values across nested calls', () => {
    let output = '';
    new Basic({write: (text) => (output += text)}, options).run(
      '10 DIM A$(1):A$(0)="BEFORE":N=2:GOSUB 100:PRINT A$(0);N:END\n100 A$(0)="AFTER":GOSUB 200:RETURN\n200 N=N+3:RETURN',
    );
    expect(output).toBe('AFTER 5 \n');
  });

  test('budgets each call, cancels pending calls and clears their frames on fresh sessions', () => {
    const source = '10 GOSUB 100:END\n100 GOSUB 200:RETURN\n200 PRINT "SUB":RETURN';
    const limited = createSelectedMa2Session(source, 2);
    expect(limited.step().nextLocation?.label).toBe(100);
    expect(limited.step().nextLocation?.label).toBe(200);
    expect(() => limited.step()).toThrow('Instruction limit of 2 reached');
    const stopped = createSelectedMa2Session(source);
    expect(stopped.step().executed).toBe(1);
    expect(stopped.cancel()).toMatchObject({status: 'halted', executed: 1, output: ''});
    expect(stopped.step()).toMatchObject({status: 'halted', executed: 1, output: ''});
    expect(createSelectedMa2Session(source).advance().output).toBe('SUB\n');
  });

  test('preserves nested call state across asynchronous scalar INPUT', async () => {
    let output = '';
    const basic = new Basic(
      {write: (text) => (output += text), readLine: () => Promise.resolve('4')},
      options,
    );
    await basic.runAsync(
      '10 GOSUB 100:PRINT N:END\n100 INPUT N:GOSUB 200:RETURN\n200 N=N+1:RETURN',
    );
    expect(output).toBe(' 5 \n');
  });
});
