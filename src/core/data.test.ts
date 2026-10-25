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

function setup(host: Partial<Host> = {}) {
  const output: string[] = [];
  return {basic: new Basic({write: (text) => output.push(text), ...host}), output};
}
function failure(action: () => unknown, code: string) {
  try {
    action();
    throw new Error('Expected failure');
  } catch (error) {
    if (!(error instanceof BasicSyntaxError || error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}
const source =
  '10 DIM A(2),S$(0):READ I,A(I),S$(0):GOSUB 100:PRINT I;":";A(1);":";S$(0);":";N:RESTORE:READ N:PRINT N:END\n100 READ N:RETURN\n200 DATA 1,-2," hi,:REM "\n300 DATA +.3e2';

describe('native DATA, READ and RESTORE', () => {
  it('retains raw signed/string literals and physical UTF-16 spans', () => {
    const line = parseLine('\t020 data - 1.5e+2, "a""b,:REM", ""', {line: 4, offset: 50})!;
    expect(line.statement).toMatchObject({
      type: 'DataStatement',
      items: [
        {
          type: 'NumberLiteral',
          value: -150,
          raw: '- 1.5e+2',
          location: {start: {line: 4, column: 11, offset: 60}, end: {column: 19}},
        },
        {type: 'StringLiteral', value: 'a"b,:REM', raw: '"a""b,:REM"'},
        {type: 'StringLiteral', value: '', raw: '""'},
      ],
    });
    expect(Object.isFrozen(line.statement)).toBe(true);
    expect(parseLine('10 READ I,A(I+1,J),S$')?.statement).toMatchObject({
      type: 'ReadStatement',
      targets: [
        {type: 'Variable', name: 'I'},
        {
          type: 'ArrayReference',
          name: 'A',
          indices: [{type: 'BinaryExpression'}, {type: 'Variable'}],
        },
        {name: 'S$'},
      ],
    });
    expect(parseLine('10 RESTORE:DATA -0')?.statement).toMatchObject({
      type: 'StatementSequence',
      statements: [{type: 'RestoreStatement'}, {items: [{value: -0}]}],
    });
  });

  it.each([
    '10 DATA',
    '10 DATA ,1',
    '10 DATA 1,',
    '10 DATA 1,,2',
    '10 DATA N',
    '10 DATA 1+2',
    '10 DATA RND()',
    '10 DATA (1)',
    '10 DATA --1',
    '10 DATA 1:PRINT 2',
    '10 DATA "x":REM comment',
    '10 DATA "x" REM comment',
    '10 DATA 1e999',
    '10 READ',
    '10 READ 1',
    '10 READ A,',
    '10 READ A+1',
    '10 READ RND()',
    '10 RESTORE 100',
    '10 RESTORE A',
    '10 DATA1,2',
    '10 READA',
  ])('rejects malformed/unsupported source %s', (text) => {
    expect(() => parseLine(text)).toThrow(BasicSyntaxError);
  });

  it('preserves existing contextual scalar/array names', () => {
    const {basic, output} = setup();
    basic.run(
      '10 DIM DATA(0),READ(0),RESTORE$(0):DATA=1:READ=2:RESTORE=3:DATA(0)=4:READ(0)=5:RESTORE$(0)="ok":PRINT DATA;READ;RESTORE;DATA(0);READ(0);RESTORE$(0)',
    );
    expect(output.join('')).toBe('12345ok\n');
  });

  it('shares one cursor across calls/loops, reads array indices sequentially, and restores/reruns fresh', () => {
    const {basic, output} = setup();
    basic.run(source);
    basic.run();
    expect(output.join('')).toBe('1:-2: hi,:REM :30\n1\n1:-2: hi,:REM :30\n1\n');
    basic.run(
      '10 DIM A(1,1):FOR I=0 TO 1:FOR J=0 TO 1:READ A(I,J):NEXT J:NEXT I:PRINT A(0,0);A(0,1);A(1,0);A(1,1):END\n20 DATA 1,2,3,4',
    );
    expect(output.at(-1)).toBe('1234\n');
  });

  it('collects by numeric label even after END, skipped IF, GOTO, or nonexecuted prefixes', () => {
    const {basic, output} = setup();
    basic.run(
      '300 DATA 3\n10 READ A,B,C,D:PRINT A;B;C;D:END\n200 IF 1=2 THEN 300:DATA 2\n100 GOTO 300:DATA 1\n400 PRINT "never":DATA 4',
    );
    expect(output.join('')).toBe('1234\n');
    basic.run('10 DATA 9\n20 READ A:RESTORE:READ B:PRINT A;B');
    expect(output.at(-1)).toBe('99\n');
    basic.run(
      '10 READ A:GOSUB 100:READ C:PRINT A;B;C:END\n100 READ B:RESTORE:RETURN\n200 DATA 1,2,3',
    );
    expect(output.at(-1)).toBe('121\n');
  });

  it('preserves empty/doubled-quote strings, backslashes, spaces and numeric signs without coercion', () => {
    const {basic, output} = setup();
    basic.run(
      '10 READ A$,B$,C$,N,M:PRINT "[";A$;"][";B$;"][";C$;"]:";N;":";M:END\n20 DATA "","a""b"," \\Q ",- .25e2,+2E-1',
    );
    expect(output.join('')).toBe('[][a"b][ \\Q ]:-25:0.2\n');
    failure(() => basic.run('10 READ N:END\n20 DATA "12"'), 'TYPE_MISMATCH');
    failure(() => basic.run('10 READ N$:END\n20 DATA 12'), 'TYPE_MISMATCH');
  });

  it('reports exhaustion at the unsatisfied target and preserves earlier assignments', () => {
    const {basic} = setup();
    const text = '10 A=7:READ A,B';
    expect(failure(() => basic.run(text + '\n20 DATA 9'), 'OUT_OF_DATA')).toMatchObject({
      label: 10,
      line: 1,
      column: text.indexOf('B') + 1,
    });
    expect(basic.variables).toEqual([{name: 'A', value: 9}]);
    const {basic: empty} = setup({
      random() {
        throw new Error('Index must not be evaluated');
      },
    });
    failure(() => empty.run('10 DIM A(0):READ A(RND())'), 'OUT_OF_DATA');
    failure(() => basic.run('10 READ N'), 'OUT_OF_DATA');
  });

  it('preserves earlier assignments on type/bounds failure and locates the failed target/index', () => {
    const {basic} = setup();
    failure(() => basic.run('10 N=7:READ N,S$,M:END\n20 DATA 2,3,4'), 'TYPE_MISMATCH');
    expect(basic.variables).toEqual([{name: 'N', value: 2}]);
    const text = '10 DIM A(0):READ N,A(1)';
    expect(failure(() => basic.run(text + '\n20 DATA 2,3'), 'ARRAY_BOUNDS').column).toBe(
      text.indexOf('(1)') + 2,
    );
    expect(basic.variables).toEqual([{name: 'N', value: 2}]);
    expect(basic.arrays[0].values).toEqual([0]);
    basic.run('10 READ N:PRINT N:END\n20 DATA 5');
    expect(basic.variables).toEqual([{name: 'N', value: 5}]);
  });

  it.each([
    ['10 PRINT "never":END:READ A(0)', 'UNDECLARED_ARRAY'],
    ['10 DIM A(0):END:READ A(0,0)', 'ARRAY_RANK_MISMATCH'],
    ['10 DIM A(0):END:READ A("x")', 'TYPE_MISMATCH'],
  ])('validates unreachable target declarations/ranks/types before effects: %s', (text, code) => {
    const {basic, output} = setup();
    basic.run(source);
    output.length = 0;
    failure(() => basic.run(text), code);
    expect(output).toEqual([]);
    basic.run();
    expect(output).toEqual(['1:-2: hi,:REM :30\n', '1\n']);
  });

  it('copies and freezes caller data/targets without retaining mutable nodes', () => {
    const mutable = structuredClone(parseProgram('10 READ A:PRINT A:END\n20 DATA 7').lines);
    const {basic, output} = setup();
    basic.reset({type: 'Program', lines: mutable});
    const data = mutable[1].statement;
    if (data.type !== 'DataStatement') throw Error('Expected DATA');
    Reflect.set(data.items[0], 'value', 99);
    const sequence = mutable[0].statement;
    if (sequence.type !== 'StatementSequence' || sequence.statements[0].type !== 'ReadStatement')
      throw Error('Expected READ');
    Reflect.set(sequence.statements[0].targets[0], 'name', 'B');
    while (basic.status !== 'halted') basic.step();
    expect(output).toEqual(['7\n']);
    basic.run();
    expect(output).toEqual(['7\n', '7\n']);
    expect(Object.isFrozen(parseProgram('10 DATA 1').lines[0].statement)).toBe(true);
  });

  it('rejects invalid caller-supplied DATA/READ lists and nonfinal DATA before effects', () => {
    const data = parseLine('10 DATA 1')!,
      read = parseLine('20 READ N')!;
    const variants: [ParsedLine, string, unknown][] = [
      [data, 'items', []],
      [data, 'items', null],
      [data, 'items', [null]],
      [data, 'items', [parseLine('30 N=1')!.statement]],
      [
        data,
        'items',
        [
          {
            ...(data.statement.type === 'DataStatement' ? data.statement.items[0] : {}),
            value: Infinity,
          },
        ],
      ],
      [data, 'items', [{type: 'StringLiteral', value: 3}]],
      [data, 'items', [{type: 'NumberLiteral', value: 12, raw: '1 2'}]],
      [read, 'targets', []],
      [read, 'targets', null],
      [read, 'targets', [null]],
      [read, 'targets', [{type: 'NumberLiteral', value: 1}]],
    ];
    for (const [line, key, value] of variants) {
      const candidate = structuredClone(line);
      Reflect.set(candidate.statement, key, value);
      failure(() => validateProgram([candidate]), 'INVALID_DATA');
    }
    const sequence = structuredClone(parseLine('10 RESTORE:DATA 1')!);
    if (sequence.statement.type !== 'StatementSequence') throw Error('Expected sequence');
    Reflect.set(sequence.statement, 'statements', [...sequence.statement.statements].reverse());
    failure(() => validateProgram([sequence]), 'INVALID_DATA');
  });

  it('enforces inclusive per-list and whole-pool bounds for source and constructed trees', () => {
    const list = new Array(4096).fill('1').join(',');
    expect(parseProgram('10 DATA ' + list).lines.length).toBe(1);
    failure(() => parseLine('10 DATA ' + list + ',1'), 'DATA_LIMIT');
    const targets = new Array(4096).fill('A').join(',');
    expect(parseLine('10 READ ' + targets)?.statement.type).toBe('ReadStatement');
    failure(() => parseLine('10 READ ' + targets + ',A'), 'DATA_LIMIT');
    for (const text of ['10 DATA 1', '10 READ A']) {
      const line = structuredClone(parseLine(text)!);
      if (line.statement.type === 'DataStatement')
        Reflect.set(line.statement, 'items', new Array(4097).fill(line.statement.items[0]));
      if (line.statement.type === 'ReadStatement')
        Reflect.set(line.statement, 'targets', new Array(4097).fill(line.statement.targets[0]));
      failure(() => validateProgram([line]), 'DATA_LIMIT');
    }
    // Aliasing caller-owned nodes must still count each pool entry.
    const line = parseLine('1 DATA ' + list)!;
    const lines = Array.from({length: 64}, (_, i) => ({...line, label: i + 1}));
    expect(validateProgram(lines).lines.length).toBe(64);
    failure(() => validateProgram([...lines, {...line, label: 65}]), 'DATA_LIMIT');
  }, 20000);

  it('steps DATA/READ lists/RESTORE once each and applies statement budgets and gates', async () => {
    const {basic, output} = setup();
    const text = '10 DATA 2,3\n20 READ N,M:RESTORE:READ N:PRINT N;M:END';
    basic.reset(text);
    expect(basic.step().nextLocation?.label).toBe(20);
    expect(basic.step().nextLocation?.start.column).toBe(13);
    expect(basic.variables).toEqual([
      {name: 'N', value: 2},
      {name: 'M', value: 3},
    ]);
    basic.step();
    basic.step();
    expect(basic.variables).toEqual([
      {name: 'N', value: 2},
      {name: 'M', value: 3},
    ]);
    let gates = 0;
    await basic.runAsync(text, {
      instructionLimit: 6,
      beforeStatement() {
        gates++;
      },
    });
    expect(gates).toBe(6);
    expect(output).toEqual(['23\n']);
    const error = await basic
      .runAsync(text, {instructionLimit: 2})
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({code: 'INSTRUCTION_LIMIT', column: 13});
  });

  it('retains the cursor across INPUT/WAIT and resets it on replacement/cancel/rerun', async () => {
    let reply!: (text: string) => void;
    const {basic, output} = setup({
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
      wait: async () => {},
    });
    const text = '10 READ A:INPUT N:WAIT 0:READ B:PRINT A;B:END\n20 DATA 2,3';
    const run = basic.runAsync(text);
    while (basic.status !== 'waiting') await Promise.resolve();
    reply('9');
    await run;
    expect(output).toEqual(['23\n']);
    const old = basic.runAsync(text).catch((error: unknown) => error);
    while (basic.status !== 'waiting') await Promise.resolve();
    await basic.runAsync('10 READ A:PRINT A:END\n20 DATA 7');
    reply('99');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(output).toEqual(['23\n', '7\n']);
    let yields = 0;
    const aborted = await basic
      .runAsync('10 RESTORE:READ N:GOTO 10\n20 DATA 1', {
        yieldEvery: 3,
        scheduler() {
          yields++;
          basic.cancel();
          return Promise.resolve();
        },
      })
      .catch((error: unknown) => error);
    expect(aborted).toMatchObject({name: 'AbortError'});
    expect(yields).toBe(1);
    basic.run('10 READ N:PRINT N:END\n20 DATA 8');
    basic.run();
    expect(output.slice(-2)).toEqual(['8\n', '8\n']);
  });

  it('isolates data readers between interleaved runtime instances', () => {
    const a = setup(),
      b = setup();
    const text = '10 READ N:READ M:PRINT N;M:END\n20 DATA 1,2';
    a.basic.reset(text);
    a.basic.step();
    b.basic.run(text);
    a.basic.step();
    a.basic.step();
    expect(a.output).toEqual(['12\n']);
    expect(b.output).toEqual(['12\n']);
  });

  it.each(['10 DATA 1', '10 READ N', '10 RESTORE'])(
    'rejects immediate %s before effects',
    async (text) => {
      const {basic, output} = setup();
      failure(() => basic.readLine(text), 'PROGRAM_REQUIRED');
      basic.reset();
      const error = await basic.readLineAsync(text).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(BasicRuntimeError);
      expect(basic.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
      expect(output).toEqual([]);
    },
  );
});
