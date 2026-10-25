import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {Host} from '../index.ts';

function setup(host: Partial<Host> = {}) {
  const output: string[] = [];
  return {output, basic: new Basic({write: (text) => output.push(text), ...host})};
}
function failure(action: () => unknown, code: string) {
  try {
    action();
    throw new Error('Expected failure');
  } catch (error) {
    expect(error instanceof BasicSyntaxError || error instanceof BasicRuntimeError).toBe(true);
    if (!(error instanceof BasicSyntaxError || error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}

const sharedSource =
  '10 DIM A(0):N=1:GOSUB 100:PRINT N;":";A(0):END\n100 N=N+2:GOSUB 200:A(0)=N:RETURN\n200 N=N*3:RETURN';

describe('literal subroutines', () => {
  it('parses contextual calls/returns with exact physical spans and immutable snapshots', () => {
    const source = '\t020 gosub 0100 : return';
    const line = parseLine(source, {line: 4, offset: 50})!;
    expect(line.statement).toMatchObject({
      type: 'StatementSequence',
      statements: [
        {
          type: 'GosubStatement',
          target: {value: 100, raw: '0100'},
          location: {start: {line: 4, column: 6, offset: 55}},
        },
        {type: 'ReturnStatement', location: {start: {line: 4, column: 19, offset: 68}}},
      ],
    });
    expect(Object.isFrozen(line.statement)).toBe(true);
    expect(parseLine('10 RETURN')?.statement.type).toBe('ReturnStatement');
    const program = parseProgram('100 RETURN\r\n10 GOSUB 100:END');
    expect(program.lines[0].source).toBe('10 GOSUB 100:END');
    const mutable = structuredClone(program.lines);
    const snapshot = validateProgram(mutable);
    const sequence = mutable[0].statement;
    if (sequence.type !== 'StatementSequence' || sequence.statements[0].type !== 'GosubStatement')
      throw new Error('Expected call');
    Reflect.set(sequence.statements[0].target, 'value', 200);
    expect(snapshot.lines[0].statement).toMatchObject({
      statements: [{target: {value: 100}}, {type: 'EndStatement'}],
    });
  });

  it.each([
    '10 GOSUB',
    '10 GOSUB N',
    '10 GOSUB -1',
    '10 GOSUB 0',
    '10 GOSUB 65536',
    '10 GOSUB 1e2',
    '10 GOSUB 1.0',
    '10 GOSUB 100+1',
    '10 GOSUB 100,200',
    '10 GO SUB 100',
    '10 GOSUB100',
    '10 RETURN 100',
    '10 RETURN,',
    '10 GOSU 100',
  ])('rejects unsupported/malformed forms %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it('preserves scalar/array names and global values through nested same-line calls', () => {
    const {basic, output} = setup();
    basic.run(
      '10 DIM GOSUB(0),RETURN(1),GOSUB$(0):GOSUB=2:RETURN=3:GOSUB(0)=4:RETURN(1)=5:GOSUB$(0)="ok":PRINT GOSUB;RETURN;GOSUB(0);RETURN(1);GOSUB$(0)',
    );
    expect(output.join('')).toBe('2345ok\n');
    output.length = 0;
    basic.run(sharedSource);
    expect(output.join('')).toBe('9:9\n');
    basic.run();
    expect(output.join('')).toBe('9:9\n9:9\n');
  });

  it('steps to the next real instruction after nested calls and returns', () => {
    const {basic, output} = setup();
    const source = '10 GOSUB 100:PRINT "done":END\n100 PRINT "sub":RETURN';
    basic.reset(source);
    expect(basic.step().nextLocation).toMatchObject({label: 100, start: {column: 5}});
    expect(basic.step().nextLocation).toMatchObject({label: 100, start: {column: 17}});
    expect(basic.step().nextLocation).toMatchObject({label: 10, start: {column: 14}});
    expect(basic.step().nextLocation).toMatchObject({label: 10, start: {column: 27}});
    expect(basic.step().status).toBe('halted');
    expect(output.join('')).toBe('sub\ndone\n');
  });

  it('supports multiple entry/return points and preserves a call across callee GOTO', () => {
    const {basic, output} = setup();
    basic.run(
      '10 N=0:GOSUB 100:GOSUB 110:PRINT N:END\n100 N=N+1:GOTO 120\n110 N=N+2:RETURN\n120 RETURN',
    );
    expect(output.join('')).toBe('3\n');
  });

  it('suspends nested caller loops and releases callee loops on early return', () => {
    const {basic, output} = setup();
    const source =
      '10 N=0:FOR I=1 TO 2:FOR K=1 TO 2:GOSUB 100:NEXT K:NEXT I:PRINT N;":";I;":";K;":";J:END\n100 FOR J=1 TO 2:GOSUB 200:RETURN:NEXT J\n200 N=N+I*K+J:RETURN';
    basic.run(source);
    expect(output.join('')).toBe('13:3:3:1\n');
    basic.run();
    expect(output.at(-1)).toBe('13:3:3:1\n');
    basic.run(
      '10 FOR I=1 TO 2:GOSUB 100:NEXT I:PRINT "ok":END\n100 FOR J=2 TO 1:PRINT "never":NEXT J:RETURN',
    );
    expect(output.at(-1)).toBe('ok\n');
  });

  it('does not restore shared scalar values or caller loop counters', () => {
    const {basic, output} = setup();
    basic.run('10 FOR I=1 TO 3:GOSUB 100:PRINT I:NEXT I:PRINT I:END\n100 I=3:RETURN');
    expect(output.join('')).toBe('3\n4\n');
  });

  it.each([
    [
      '10 FOR I=1 TO 2:GOSUB 100:NEXT I:END\n100 FOR I=1 TO 2:NEXT I:RETURN',
      'LOOP_VARIABLE_ACTIVE',
    ],
    ['10 GOSUB 110:END\n100 FOR I=1 TO 2\n110 PRINT "never"\n120 NEXT I:RETURN', 'LOOP_ENTRY'],
  ])('rejects illegal call/loop interactions %s', (source, code) => {
    const {basic} = setup();
    failure(() => basic.run(source), code);
    expect(basic.run('10 FOR I=1 TO 1:NEXT I:END').status).toBe('halted');
  });

  it('rejects a callee GOTO into a suspended caller loop and preserves native guards', () => {
    const {basic} = setup();
    failure(
      () => basic.run('10 FOR I=1 TO 2\n20 GOSUB 100\n30 NEXT I\n40 END\n100 GOTO 30:RETURN'),
      'LOOP_ENTRY',
    );
    expect(basic.run('10 FOR I=1 TO 1:NEXT I:END').status).toBe('halted');
  });

  it('checks even unreachable call targets before any host effect and retains a prior program', () => {
    const {basic, output} = setup();
    basic.run(sharedSource);
    output.length = 0;
    const source = '10 PRINT "never":END:GOSUB 999';
    const d = failure(() => basic.run(source), 'MISSING_TARGET');
    expect(d.column).toBe(source.indexOf('999') + 1);
    expect(output).toEqual([]);
    basic.run();
    expect(output.join('')).toBe('9:9\n');
  });

  it('reports unmatched RETURN at the real column and clears all stacks after errors', () => {
    const {basic, output} = setup();
    failure(() => basic.run('10 PRINT "before":RETURN:PRINT "never"'), 'RETURN_WITHOUT_GOSUB');
    expect(basic.state.diagnostic?.column).toBe(19);
    expect(output).toEqual(['before\n']);
    failure(
      () => basic.run('10 GOSUB 100:END\n100 GOSUB 200:RETURN\n200 PRINT 1/0:RETURN'),
      'DIVISION_BY_ZERO',
    );
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
    expect(basic.run(sharedSource).status).toBe('halted');
  });

  it('allows exactly 1024 active calls and rejects another without JS recursion', async () => {
    const {basic, output} = setup();
    const source =
      '10 N=0:GOSUB 100:PRINT N:END\n100 N=N+1:IF N=1024 THEN 130\n110 GOSUB 100\n120 RETURN\n130 RETURN';
    await basic.runAsync(source, {instructionLimit: 6000});
    expect(output.join('')).toBe('1024\n');
    const error = await basic
      .runAsync(source.replace('N=1024', 'N=1025'), {instructionLimit: 6000})
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({code: 'CALL_STACK_LIMIT', label: 110, column: 5});
    expect(basic.variables.find((v) => v.name === 'N')?.value).toBe(1024);
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
  });

  it('returns to program end and drops frames on END or natural exhaustion', () => {
    const {basic, output} = setup();
    basic.run('10 GOTO 100\n20 PRINT "sub":RETURN\n100 GOSUB 20');
    expect(output.join('')).toBe('sub\n');
    basic.run('10 GOSUB 100:PRINT "never"\n100 PRINT "falloff"');
    basic.run('10 GOSUB 100:PRINT "never"\n100 END');
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
    expect(output.join('')).toBe('sub\nfalloff\n');
  });

  it('isolates separately stepped instances and counts each call/return as one gate', async () => {
    const a = setup(),
      b = setup();
    const source = '10 GOSUB 100:PRINT "done":END\n100 RETURN';
    a.basic.reset(source);
    a.basic.step();
    b.basic.run(source);
    a.basic.step();
    expect(a.basic.state.nextLocation?.start.column).toBe(14);
    expect(a.output).toEqual([]);
    expect(b.output).toEqual(['done\n']);
    let gates = 0;
    await a.basic.runAsync(source, {
      instructionLimit: 4,
      beforeStatement() {
        gates++;
      },
    });
    expect(gates).toBe(4);
    const error = await a.basic
      .runAsync(source, {instructionLimit: 1})
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(a.basic.state.diagnostic).toMatchObject({
      code: 'INSTRUCTION_LIMIT',
      label: 100,
      column: 5,
    });
  });

  it('releases pending subroutine INPUT on replacement and ignores a late reply', async () => {
    let reply!: (text: string) => void;
    const {basic, output} = setup({
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
    });
    const old = basic
      .runAsync('10 FOR I=1 TO 2:GOSUB 100:NEXT I:PRINT "stale":END\n100 INPUT N:RETURN')
      .catch((error: unknown) => error);
    while (basic.status !== 'waiting') await Promise.resolve();
    await basic.runAsync('10 FOR I=1 TO 1:NEXT I:PRINT "fresh":END');
    reply('9');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(output.join('')).toBe('fresh\n');
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
  });

  it('cancels subroutine WAIT and a recursive call stream at statement boundaries', async () => {
    const {basic, output} = setup({wait: () => new Promise<void>(() => {})});
    const old = basic
      .runAsync('10 GOSUB 100:PRINT "never":END\n100 WAIT 0:RETURN')
      .catch((error: unknown) => error);
    while (basic.status !== 'waiting') await Promise.resolve();
    basic.cancel();
    expect(await old).toMatchObject({name: 'AbortError'});
    let yields = 0;
    const error = await basic
      .runAsync('10 GOSUB 10', {
        yieldEvery: 4,
        scheduler() {
          yields++;
          basic.cancel();
          return Promise.resolve();
        },
      })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({name: 'AbortError'});
    expect(yields).toBe(1);
    expect(output).toEqual([]);
    expect(basic.run(sharedSource).status).toBe('halted');
  });

  it.each(['10 GOSUB 100', '10 RETURN'])('rejects immediate %s before effects', async (source) => {
    const {basic, output} = setup();
    failure(() => basic.readLine(source), 'PROGRAM_REQUIRED');
    basic.reset();
    const error = await basic.readLineAsync(source).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
    expect(output).toEqual([]);
  });
});
