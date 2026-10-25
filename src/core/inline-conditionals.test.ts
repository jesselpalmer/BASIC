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
  return {basic: new Basic({write: (text) => output.push(text), ...host}), output};
}
function failure(action: () => unknown, code: string) {
  try {
    action();
    throw Error('Expected failure');
  } catch (error) {
    if (!(error instanceof BasicSyntaxError || error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}
const watch = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

describe('native inline IF', () => {
  it('preserves old literal IF ASTs, adds a GOTO spelling, and retains new physical spans', () => {
    expect(parseLine('10 IF A=1 GOTO 20')?.statement).toEqual(
      parseLine('10 IF A=1 THEN 20')?.statement,
    );
    const source = '\t020 if a=1 then print "ELSE:x" else a=2';
    const line = parseLine(source, {line: 4, offset: 50})!;
    expect(line.statement).toMatchObject({
      type: 'InlineIfStatement',
      consequent: {
        type: 'PrintStatement',
        location: {
          start: {
            line: 4,
            column: source.indexOf('print') + 1,
            offset: 50 + source.indexOf('print'),
          },
        },
      },
      alternate: {type: 'LetStatement', target: {name: 'A'}},
    });
    expect(Object.isFrozen(line.statement)).toBe(true);
    expect(parseLine('10 IF A=1 THEN PRINT A')?.statement).toMatchObject({
      type: 'InlineIfStatement',
      alternate: null,
    });
  });

  it.each([
    ['1=1', 'yes\nnext\n'],
    ['1=2', 'no\ntail\nnext\n'],
  ])('applies the physical last-clause rule for %s', (condition, expected) => {
    const {basic, output} = setup();
    basic.run(`10 IF ${condition} THEN PRINT "yes" ELSE PRINT "no":PRINT "tail"\n20 PRINT "next"`);
    expect(output.join('')).toBe(expected);
  });

  it.each([
    [0, 0, 'outer\ntail\nnext\n'],
    [0, 1, 'outer\ntail\nnext\n'],
    [1, 0, 'inner\nnext\n'],
    [1, 1, 'both\nnext\n'],
  ])('binds dangling ELSE to the nearest IF: %s,%s', (a, b, expected) => {
    const {basic, output} = setup();
    basic.run(
      `10 A=${a}:B=${b}\n20 IF A=1 THEN IF B=1 THEN PRINT "both" ELSE PRINT "inner" ELSE PRINT "outer":PRINT "tail"\n30 PRINT "next"`,
    );
    expect(output.join('')).toBe(expected);
  });

  it.each([
    [0, 0, 'next\n'],
    [0, 1, 'next\n'],
    [1, 0, 'next\n'],
    [1, 1, 'both\ntail\nnext\n'],
  ])('skips the entire physical line without ELSE: %s,%s', (a, b, expected) => {
    const {basic, output} = setup();
    basic.run(`10 IF ${a}=1 THEN IF ${b}=1 THEN PRINT "both":PRINT "tail"\n20 PRINT "next"`);
    expect(output.join('')).toBe(expected);
  });

  it('handles all literal/statement target combinations without synthetic instructions', async () => {
    const {basic, output} = setup();
    for (const source of [
      '10 IF 1=1 THEN 30 ELSE PRINT "wrong":PRINT "wrong"\n20 END\n30 PRINT "yes"',
      '10 IF 1=2 THEN PRINT "wrong" ELSE 30:PRINT "wrong"\n20 END\n30 PRINT "yes"',
      '10 IF 1=1 GOTO 30 ELSE 20\n20 END\n30 PRINT "yes"',
      '10 IF 1=2 THEN 20 ELSE 30\n20 END\n30 PRINT "yes"',
    ]) {
      let gates = 0;
      await basic.runAsync(source, {
        instructionLimit: 2,
        beforeStatement() {
          gates++;
        },
      });
      expect(gates).toBe(2);
    }
    expect(output).toEqual(new Array<string>(4).fill('yes\n'));
  });

  it('preserves ELSE/USING scalar and array names outside contextual markers', () => {
    const {basic, output} = setup();
    basic.run(
      '10 DIM ELSE(0):ELSE=2:ELSE(0)=3:USING=4\n20 PRINT ELSE;ELSE(0):IF 1=1 THEN PRINT (ELSE);ELSE(0) ELSE PRINT USING\n30 IF 1=2 THEN PRINT USING ELSE PRINT USING;(ELSE)\n40 IF 1=1 THEN ELSE=5 ELSE ELSE=6\n50 PRINT ELSE',
    );
    expect(output.join('')).toBe('23\n23\n42\n5\n');
  });

  it('keeps markers in strings/comments literal and handles empty/trailing PRINT and formatted output', () => {
    const {basic, output} = setup();
    basic.run(
      '10 IF 1=1 THEN PRINT "ELSE:x"; ELSE PRINT "wrong"\n20 IF 1=2 THEN PRINT ELSE PRINT USING "#",2\n30 IF 1=1 THEN REM : ELSE PRINT "ignored\n40 PRINT "done"',
    );
    expect(output.join('')).toBe('ELSE:x2\ndone\n');
  });

  it.each([
    '10 IF 1=1 THEN',
    '10 IF 1=1 THEN PRINT "x" ELSE',
    '10 IF 1=1 THEN :PRINT 2',
    '10 IF 1=1 THEN PRINT 1:ELSE PRINT 2',
    '10 IF 1=1 THEN 20 ELSE 30 ELSE 40',
    '10 IF 1=1 THEN FOR I=1 TO 2',
    '10 IF 1=1 THEN NEXT I',
    '10 IF 1=1 THEN DIM A(0)',
    '10 IF 1=1 THEN DATA 1',
    '10 IF 1=1 THEN PRINT 2 ELSE DATA 1',
    '10 IF 1=1 GOTO PRINT 2',
    '10 IF 1=1 THEN PRINT 2 ELSE -1',
    '10 IF 1=1 THEN PRINT 2 ELSE 1e2',
    '10 IF 1=1 THEN PRINT 2 ELSE 0',
    '10 IF 1=1 THEN PRINT 2 ELSE 65536',
  ])('rejects malformed/unsupported branch syntax %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it.each([
    ['10 PRINT "never":END:IF 1=1 THEN PRINT "ok" ELSE 999', 'MISSING_TARGET'],
    ['10 PRINT "never":IF 1=2 THEN GOSUB 999 ELSE END', 'MISSING_TARGET'],
    ['10 PRINT "never":IF 1=2 THEN PRINT A(0) ELSE END', 'UNDECLARED_ARRAY'],
    ['10 PRINT "never":IF 1=2 THEN IF "a"<"b" THEN PRINT 1 ELSE END', 'TYPE_MISMATCH'],
    ['10 PRINT "never":IF 1=2 THEN WAIT "x" ELSE END', 'TYPE_MISMATCH'],
  ])('preflights unchosen/dead branches before effects %s', (source, code) => {
    const {basic, output} = setup();
    basic.run('10 PRINT "kept"');
    output.length = 0;
    failure(() => basic.run(source), code);
    expect(output).toEqual([]);
    basic.run();
    expect(output).toEqual(['kept\n']);
  });

  it('does not evaluate unchosen bodies or later conditions and locates selected failures', () => {
    let random = 0;
    const {basic, output} = setup({
      random() {
        random++;
        return 0.5;
      },
    });
    basic.run(
      '10 IF 1=2 THEN IF RND()=1 THEN PRINT 1/0 ELSE PRINT UNKNOWN\n20 IF 1=1 THEN PRINT "ok" ELSE PRINT 1/0',
    );
    expect(random).toBe(0);
    expect(output).toEqual(['ok\n']);
    const source = '10 IF 1=1 THEN N=1/0 ELSE N=2';
    failure(() => basic.run(source), 'DIVISION_BY_ZERO');
    expect(basic.state.diagnostic?.column).toBe(source.indexOf('/') + 1);
  });

  it('returns from conditional GOSUB to the chosen clause continuation', () => {
    const {basic, output} = setup();
    basic.run(
      '10 IF 1=1 THEN GOSUB 100 ELSE PRINT "wrong":PRINT "wrong tail"\n20 PRINT "next":END\n100 PRINT "sub":RETURN',
    );
    basic.run(
      '10 IF 1=2 THEN PRINT "wrong" ELSE GOSUB 100:PRINT "tail"\n20 END\n100 PRINT "sub":RETURN',
    );
    basic.run('10 IF 1=1 THEN GOSUB 100:PRINT "tail":END\n100 RETURN');
    expect(output.join('')).toBe('sub\nnext\nsub\ntail\ntail\n');
  });

  it('preserves caller/callee loop ownership, nested returns and END transfers', () => {
    const {basic, output} = setup();
    basic.run(
      '10 FOR I=1 TO 2:GOSUB 100:NEXT I:PRINT I:END\n100 FOR J=1 TO 2\n110 IF J=1 THEN IF I>0 THEN RETURN ELSE PRINT "wrong":PRINT "wrong tail"\n120 NEXT J:RETURN',
    );
    expect(output).toEqual(['3\n']);
    basic.run('10 IF 1=1 THEN END ELSE PRINT "wrong":PRINT "wrong tail"\n20 PRINT "wrong"');
    expect(output).toEqual(['3\n']);
    failure(() => basic.run('10 IF 1=1 THEN RETURN ELSE PRINT "wrong"'), 'RETURN_WITHOUT_GOSUB');
  });

  it('applies native guards to completed clauses that skip FOR headers or leave loop bodies', async () => {
    const {basic, output} = setup();
    failure(
      () => basic.run('10 IF 1=1 THEN PRINT "before" ELSE PRINT "wrong":FOR I=1 TO 2\n20 NEXT I'),
      'LOOP_ENTRY',
    );
    expect(output).toEqual(['before\n']);
    basic.run(
      '10 FOR I=1 TO 2:IF I=1 THEN PRINT "one" ELSE PRINT "two":NEXT I\n20 FOR I=1 TO 1:NEXT I:PRINT "fresh"',
    );
    expect(output.slice(-2)).toEqual(['one\n', 'fresh\n']);
    const error = await watch(
      basic.runAsync('10 IF 1=1 THEN WAIT 0 ELSE END:FOR I=1 TO 2\n20 NEXT I'),
    );
    expect(error).toMatchObject({diagnostic: {code: 'LOOP_ENTRY'}});
    const literal = '10 IF 1=1 THEN 30 ELSE END';
    expect(
      failure(
        () => basic.run(literal + '\n20 FOR I=1 TO 2\n30 PRINT "wrong"\n40 NEXT I'),
        'LOOP_ENTRY',
      ).column,
    ).toBe(literal.indexOf('30') + 1);
  });

  it('steps conditions and selected statements once at real physical columns', async () => {
    const {basic, output} = setup();
    const source = '10 IF 1=1 THEN PRINT "yes" ELSE PRINT "no":PRINT "tail"\n20 END';
    basic.reset(source);
    expect(basic.step().nextLocation?.start.column).toBe(source.indexOf('PRINT') + 1);
    expect(output).toEqual([]);
    expect(basic.step().nextLocation?.label).toBe(20);
    expect(output).toEqual(['yes\n']);
    basic.step();
    let gates = 0;
    await basic.runAsync(source, {
      instructionLimit: 3,
      beforeStatement() {
        gates++;
      },
    });
    expect(gates).toBe(3);
    expect(await watch(basic.runAsync(source, {instructionLimit: 1}))).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT', column: source.indexOf('PRINT') + 1},
    });
  });

  it('preserves INPUT/WAIT continuations, shared DATA and fresh reruns', async () => {
    const output: string[] = [];
    let answers = ['2,3', '4,5'];
    const basic = new Basic({
      write: (text) => output.push(text),
      readLine: () => Promise.resolve(answers.shift() ?? null),
      wait: () => Promise.resolve(),
    });
    const source =
      '10 READ C:IF C=1 THEN INPUT A,B ELSE PRINT "wrong":PRINT "wrong tail"\n20 IF A=2 THEN WAIT 0 ELSE END:PRINT "wrong tail"\n30 READ C:PRINT A;B;C:END\n100 DATA 1,9';
    await basic.runAsync(source);
    expect(output).toEqual(['239\n']);
    answers = ['2,3'];
    await basic.runAsync();
    expect(output).toEqual(['239\n', '239\n']);
  });

  it('cancels suspended branch bodies and discards late replies after replacement', async () => {
    let reply!: (text: string) => void;
    const {basic, output} = setup({
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
      wait: () => new Promise<void>(() => {}),
    });
    const old = watch(
      basic.runAsync(
        '10 IF 1=1 THEN INPUT N ELSE PRINT "wrong":PRINT "wrong tail"\n20 PRINT "old"',
      ),
    );
    while (basic.status !== 'waiting') await Promise.resolve();
    basic.run('10 PRINT "fresh"');
    reply('9');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(output).toEqual(['fresh\n']);
    const wait = watch(basic.runAsync('10 IF 1=1 THEN WAIT 1 ELSE END\n20 PRINT "old"'));
    while (basic.status !== 'waiting') await Promise.resolve();
    basic.cancel();
    expect(await wait).toMatchObject({name: 'AbortError'});
    expect(output).toEqual(['fresh\n']);
  });

  it('isolates immutable constructed branch trees and independent stepped runtimes', () => {
    const mutable = structuredClone(
      parseProgram('10 IF 1=1 THEN PRINT "yes" ELSE PRINT "no":PRINT "tail"\n20 END').lines,
    );
    const a = setup(),
      b = setup();
    a.basic.reset({type: 'Program', lines: mutable});
    const sequence = mutable[0].statement;
    if (
      sequence.type !== 'StatementSequence' ||
      sequence.statements[0].type !== 'InlineIfStatement'
    )
      throw Error('Expected conditional');
    Reflect.set(sequence.statements[0], 'consequent', parseLine('30 PRINT "changed"')!.statement);
    a.basic.step();
    b.basic.run('10 IF 1=2 THEN PRINT "wrong" ELSE PRINT "other"');
    a.basic.step();
    expect(a.output).toEqual(['yes\n']);
    expect(b.output).toEqual(['other\n']);
  });

  it('enforces inclusive conditional depth/node limits without JS recursion in preparation', () => {
    const prefix = 'IF 1=1 THEN ';
    const {basic, output} = setup();
    basic.run('10 ' + prefix.repeat(128) + 'PRINT "ok"');
    expect(output).toEqual(['ok\n']);
    failure(() => parseLine('10 ' + prefix.repeat(129) + 'PRINT 1'), 'CONDITIONAL_LIMIT');
    const clauses = new Array<string>(2048).fill('IF 1=1 THEN N=1').join(':');
    expect(parseProgram('10 ' + clauses).lines).toHaveLength(1);
    failure(() => parseLine('10 ' + clauses + ':END'), 'STATEMENT_LIMIT');
    const leaf = parseLine('10 PRINT 1')!.statement;
    const line = structuredClone(parseLine('10 IF 1=1 THEN PRINT 1')!);
    if (line.statement.type !== 'InlineIfStatement') throw Error('Expected IF');
    let nested = line.statement;
    for (let i = 1; i < 129; i++) nested = {...line.statement, consequent: nested};
    failure(() => validateProgram([{...line, statement: nested}]), 'CONDITIONAL_LIMIT');
    Reflect.set(line.statement, 'consequent', line.statement);
    failure(() => validateProgram([line]), 'CONDITIONAL_LIMIT');
    const sequence = structuredClone(parseLine('10 END:END')!);
    if (sequence.statement.type !== 'StatementSequence') throw Error('Expected sequence');
    Reflect.set(
      sequence.statement,
      'statements',
      new Array(2049).fill({...nested, consequent: leaf}),
    );
    Reflect.set(
      sequence.statement,
      'separators',
      new Array(2048).fill(sequence.statement.separators[0]),
    );
    failure(() => validateProgram([sequence]), 'STATEMENT_LIMIT');
  }, 20000);

  it('rejects malformed/forbidden constructed branches and malformed literal targets', () => {
    const line = parseLine('10 IF 1=1 THEN PRINT 1 ELSE PRINT 2')!;
    for (const [branch, code] of [
      [null, 'INVALID_CONDITIONAL'],
      [{type: 'StatementSequence'}, 'INVALID_CONDITIONAL'],
      [parseLine('10 DIM A(0)')!.statement, 'UNSUPPORTED_BRANCH'],
      [{type: 'NumberLiteral', value: 0, raw: '0', location: line.location}, 'INVALID_TARGET'],
    ] as const) {
      const candidate = structuredClone(line);
      Reflect.set(candidate.statement, 'consequent', branch);
      failure(() => validateProgram([candidate]), code);
    }
  });

  it('rejects immediate conditionals before any condition/body effects', async () => {
    const {basic, output} = setup();
    failure(() => basic.readLine('10 IF RND()=1 THEN PRINT 1'), 'PROGRAM_REQUIRED');
    basic.reset();
    expect(await watch(basic.readLineAsync('10 IF 1=1 THEN PRINT 1'))).toMatchObject({
      diagnostic: {code: 'PROGRAM_REQUIRED'},
    });
    expect(output).toEqual([]);
  });
});
