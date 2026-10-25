import {describe, expect, it} from 'bun:test';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import type {Host, ParsedLine} from '../index.ts';
import {programInstructions} from './instructions.ts';

function setup(host: Partial<Host> = {}) {
  const output: string[] = [];
  return {output, basic: new Basic({write: (text) => output.push(text), ...host})};
}
function failure(action: () => unknown, code: string) {
  try {
    action();
    throw new Error('Expected failure');
  } catch (error) {
    expect(error instanceof BasicRuntimeError || error instanceof BasicSyntaxError).toBe(true);
    if (!(error instanceof BasicRuntimeError || error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}

describe('numbered statement sequences', () => {
  it('keeps exact source, immutable leaf spans and real separators across CRLF and labels', () => {
    const source = '20 END\r\n\t010 a=1 : PRINT "x:y";a : REM : PRINT "not code"';
    const program = parseProgram(source);
    const line = program.lines[0];
    expect(line.source).toBe('\t010 a=1 : PRINT "x:y";a : REM : PRINT "not code"');
    const sequence = line.statement;
    expect(sequence.type).toBe('StatementSequence');
    if (sequence.type !== 'StatementSequence') throw new Error('Expected sequence');
    expect(sequence.statements.map((s) => s.type)).toEqual([
      'LetStatement',
      'PrintStatement',
      'RemStatement',
    ]);
    expect(sequence.statements.map((s) => s.location.start.column)).toEqual([6, 12, 28]);
    expect(sequence.separators.map((s) => source.slice(s.start.offset, s.end.offset))).toEqual([
      ':',
      ':',
    ]);
    expect(sequence.statements[2]).toMatchObject({text: ' : PRINT "not code"'});
    expect(Object.isFrozen(sequence.statements)).toBe(true);
    const instructions = programInstructions(program.lines);
    expect(instructions.map((i) => [i.label, i.ordinal, i.nextLineIndex])).toEqual([
      [10, 0, 3],
      [10, 1, 3],
      [10, 2, 3],
      [20, 0, 4],
    ]);
    expect(instructions[1].line).toBe(line);
    expect(instructions[1].statement).toBe(sequence.statements[1]);
    expect(Object.isFrozen(instructions[1])).toBe(true);
  });

  it.each([
    '10 :PRINT 1',
    '10 PRINT 1:',
    '10 PRINT 1::END',
    '10 LET A=1: :END',
    '10 PRINT 1:PRNIT 2',
    '10 PRINT 1:20 PRINT 2',
    '10 PRINT 1\\PRINT 2',
  ])('rejects malformed or unsupported sequences %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it('does not reinterpret USING because a later statement contains a comma', () => {
    const {basic, output} = setup();
    basic.run(
      '10 USING=4:DIM USING(1,2):USING(1,2)=7:PRINT USING:PRINT USING "#:#",1,2;:PRINT USING(1,2)',
    );
    expect(output.join('')).toBe('4\n1:27\n');
    expect(parseLine('10 PRINT:PRINT "x";:PRINT')?.statement).toMatchObject({
      type: 'StatementSequence',
      statements: [
        {type: 'PrintStatement', items: []},
        {type: 'PrintStatement', trailingSemicolon: true},
        {type: 'PrintStatement', items: []},
      ],
    });
  });

  it('executes and steps each leaf without charging the structural sequence', async () => {
    const {basic, output} = setup();
    const source = '10 A=1: A=A+2: PRINT A: END: PRINT "never"';
    basic.reset(source);
    const columns: number[] = [];
    while (basic.status !== 'halted') {
      columns.push(basic.state.nextLocation!.start.column);
      basic.step();
    }
    expect(columns).toEqual([4, 9, 16, 25]);
    expect(output).toEqual(['3\n']);
    output.length = 0;
    let gates = 0;
    await basic.runAsync(source, {
      instructionLimit: 4,
      beforeStatement() {
        gates++;
      },
    });
    expect(gates).toBe(4);
    expect(output).toEqual(['3\n']);
    const error = await basic
      .runAsync(source, {instructionLimit: 2})
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({
      code: 'INSTRUCTION_LIMIT',
      label: 10,
      column: 16,
    });
    expect(output).toEqual(['3\n']);
  });

  it('pairs nested and empty loops at instruction positions and resumes after same-line NEXT', () => {
    const {basic, output} = setup();
    basic.run(
      '10 N=0:FOR I=1 TO 2:FOR J=1 TO 2:N=N+I*J:NEXT J:NEXT I:PRINT N;":";I;":";J\n20 FOR K=2 TO 1:PRINT "skipped":NEXT K:PRINT "after"',
    );
    expect(output.join('')).toBe('9:3:3\nafter\n');
    failure(() => basic.run('10 FOR I=1 TO 2:NEXT J'), 'MISMATCHED_NEXT');
    failure(() => basic.run('10 PRINT "never":FOR I=1 TO 2'), 'MISSING_NEXT');
    failure(() => basic.run('10 PRINT "never":NEXT I'), 'UNMATCHED_NEXT');
  });

  it('jumps to line entries and preserves false IF line scope', () => {
    const {basic, output} = setup();
    basic.run(
      '10 N=0\n20 N=N+1:IF N<3 THEN 20:PRINT "skipped false"\n30 PRINT N:GOTO 50:PRINT "unreachable"\n40 PRINT "wrong"\n50 PRINT "end":END:PRINT "never"',
    );
    expect(output.join('')).toBe('3\nend\n');
    basic.run('10 A=1:IF A=1 THEN 30:PRINT "unreachable"\n20 PRINT "wrong"\n30 PRINT "true"');
    expect(output.at(-1)).toBe('true\n');
    failure(() => basic.run('10 IF 1=0 THEN 30:FOR I=1 TO 2\n20 NEXT I\n30 END'), 'LOOP_ENTRY');
  });

  it.each([
    ['10 PRINT "never":END:GOTO 90', 'MISSING_TARGET'],
    ['10 PRINT "never":END:WAIT "x"', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:PSET "x",0', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:PRINT KEYDOWN(1)', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:PRINT USING 1,2', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:PRINT A(0)', 'UNDECLARED_ARRAY'],
    ['10 PRINT "never":END:DIM A(1),A(2)', 'DUPLICATE_DIM'],
  ])('validates all later statements before effects %s', (source, code) => {
    let effects = 0;
    const basic = new Basic({
      write() {
        effects++;
      },
      random() {
        effects++;
        return 0.5;
      },
    });
    failure(() => basic.run(source), code);
    expect(effects).toBe(0);
  });

  it('reports the failing later statement column and isolates fresh runs', () => {
    const {basic, output} = setup();
    const source = '10 PRINT "before":PRINT "partial";1/0:PRINT "never"';
    const diagnostic = failure(() => basic.run(source), 'DIVISION_BY_ZERO');
    expect(diagnostic.column).toBe(source.indexOf('/') + 1);
    expect(output).toEqual(['before\n']);
    basic.run('10 DIM A(0):A(0)=A(0)+1:PRINT A(0)');
    basic.run();
    expect(output).toEqual(['before\n', '1\n', '1\n']);
    failure(() => basic.reset('10 END:PRINT A(0)'), 'UNDECLARED_ARRAY');
    basic.run();
    expect(output.at(-1)).toBe('1\n');
  });

  it('enforces the per-line bound in source and constructed snapshots before effects', () => {
    expect(parseProgram('10 ' + Array(4096).fill('CLS').join(':')).lines).toHaveLength(1);
    failure(() => parseLine('10 ' + Array(4097).fill('CLS').join(':')), 'STATEMENT_LIMIT');
    const line = structuredClone(parseLine('10 CLS:END')!);
    if (line.statement.type !== 'StatementSequence') throw new Error('Expected sequence');
    for (const [statements, separators, code] of [
      [[], [], 'INVALID_SEQUENCE'],
      [null, [], 'INVALID_SEQUENCE'],
      [[line.statement.statements[0]], [], 'INVALID_SEQUENCE'],
      [[null, line.statement.statements[0]], [line.statement.separators[0]], 'INVALID_SEQUENCE'],
      [
        [{type: 'StatementSequence'}, line.statement.statements[0]],
        [line.statement.separators[0]],
        'INVALID_SEQUENCE',
      ],
      [[...line.statement.statements], [], 'INVALID_SEQUENCE'],
      [
        Array(4097).fill(line.statement.statements[0]),
        Array(4096).fill(line.statement.separators[0]),
        'STATEMENT_LIMIT',
      ],
    ] as const) {
      const candidate = {
        ...line,
        statement: {...line.statement, statements, separators},
      } as unknown as ParsedLine;
      failure(() => validateProgram([candidate]), code);
    }
    const frozen = validateProgram([line]);
    Reflect.set(line.statement.statements[0], 'type', 'EndStatement');
    expect(
      (frozen.lines[0].statement as {statements: readonly {type: string}[]}).statements[0].type,
    ).toBe('ClsStatement');
  });

  it('rejects immediate sequences before any member effect in sync and async entry', async () => {
    const {basic, output} = setup();
    failure(() => basic.readLine('10 PRINT "never":CLS'), 'PROGRAM_REQUIRED');
    expect(output).toEqual([]);
    basic.reset();
    const error = await basic
      .readLineAsync('10 PRINT "never":WAIT 0')
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(output).toEqual([]);
  });

  it('continues INPUT and WAIT at their next same-line instruction, with fresh cancellation/replacement', async () => {
    const {basic, output} = setup({
      readLine: () => Promise.resolve('4'),
      wait: () => Promise.resolve(),
    });
    basic.reset('10 A=1:INPUT N:WAIT 0:PRINT A+N');
    await basic.stepAsync();
    expect(basic.state.nextLocation?.start.column).toBe(8);
    await basic.stepAsync();
    expect(basic.state.nextLocation?.start.column).toBe(16);
    await basic.stepAsync();
    expect(basic.state.nextLocation?.start.column).toBe(23);
    await basic.stepAsync();
    expect(output).toEqual(['5\n']);
    let reply!: (text: string) => void;
    const pending = setup({
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
    });
    const old = pending.basic
      .runAsync('10 PRINT "old":INPUT N:PRINT "stale"')
      .catch((error: unknown) => error);
    while (pending.basic.status !== 'waiting') await Promise.resolve();
    expect(pending.basic.state.currentLocation?.start.column).toBe(16);
    await pending.basic.runAsync('10 PRINT "new":END');
    reply('9');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(pending.output.join('')).toBe('old\nnew\n');
  });

  it('cancels bounded same-line loops at real statement boundaries', async () => {
    const {basic} = setup();
    let yields = 0;
    const error = await basic
      .runAsync('10 FOR I=1 TO 1000000:NEXT I:END', {
        yieldEvery: 2,
        scheduler: () => {
          yields++;
          basic.cancel();
          return Promise.resolve();
        },
      })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({name: 'AbortError'});
    expect(yields).toBe(1);
    expect(basic.run('10 PRINT "recovered":END').status).toBe('halted');
  });
});
