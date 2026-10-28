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
import type {NodeOf} from './types.ts';
import {dispatchTarget} from './dispatch.ts';

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
function dispatch(source = '10 ON 1 GOTO 20,30'): NodeOf<'OnStatement'> {
  const statement = parseLine(source)!.statement;
  if (statement.type !== 'OnStatement') throw Error('Expected ON');
  return statement;
}

describe('native computed dispatch', () => {
  it('parses contextual ON with exact original locations and a frozen target list', () => {
    const source = '\t020 on 2.9 gosub 0100, 00200';
    const line = parseLine(source, {line: 4, offset: 50})!;
    expect(line.statement).toMatchObject({
      type: 'OnStatement',
      transfer: 'gosub',
      selector: {value: 2.9},
      targets: [
        {value: 100, raw: '0100'},
        {value: 200, raw: '00200'},
      ],
      location: {start: {line: 4, column: 6, offset: 55}},
    });
    if (line.statement.type !== 'OnStatement') throw Error('Expected ON');
    expect(line.statement.targets[1].location.start).toEqual({
      line: 4,
      column: source.indexOf('00200') + 1,
      offset: source.indexOf('00200') + 50,
    });
    expect(Object.isFrozen(line.statement.targets)).toBe(true);
    expect(Object.isFrozen(line.statement.targets[0])).toBe(true);
  });

  it('preserves ON/GOSUB scalar, array and string names and resolves ambiguous selector names', () => {
    const {basic, output} = setup();
    basic.run(
      '10 DIM ON(0),ON$(0),GOSUB(0):ON=1:ON(0)=2:ON$(0)="ok":GOSUB=2:GOSUB(0)=1\n20 ON ON(0) GOSUB 100,110:ON GOSUB GOSUB 100,110:PRINT ON;ON(0);ON$(0);GOSUB;GOSUB(0):END\n100 PRINT "one":RETURN\n110 PRINT "two":RETURN',
    );
    expect(output.join('')).toBe('two\ntwo\n12ok21\n');
    expect(parseLine('10 ON=2')!.statement.type).toBe('LetStatement');
    expect(parseLine('10 ON(0)=2')!.statement.type).toBe('LetStatement');
  });

  it('distinguishes grouped selectors from ON array assignment, including nested calls and IF bodies', () => {
    let reads = 0;
    const {basic, output} = setup({
      random: () => {
        reads++;
        return 0.8;
      },
    });
    basic.run(
      '10 DIM ON(1,1):ON((0),INT(1.9))=2:ERROR=1\n20 ON (ON(0,1)) GOSUB 100,200:ON ERROR GOSUB 100\n30 IF 1=1 THEN ON (RND()*2+1) GOSUB 100,200:END\n100 PRINT "one":RETURN\n200 PRINT "two":RETURN',
    );
    expect(output.join('')).toBe('two\none\ntwo\n');
    expect(reads).toBe(1);
    failure(() => basic.run('10 ON ERROR GOTO 10'), 'UNDEFINED_VARIABLE');
    for (const source of ['10 ON (1', '10 ON (1\n20 END', '10 ON (1,2) GOTO 20', '10 ON (0)='])
      expect(() => parseLine(source)).toThrow(BasicSyntaxError);
    expect(parseLine('10 ON ((0)+1)=2')!.statement.type).toBe('LetStatement');
  });

  it.each([
    [1, 'one'],
    [1.999, 'one'],
    [2, 'two'],
    [2.999, 'two'],
    [3, 'three'],
    [3.999, 'three'],
  ])('truncates selector %s before one-based GOTO selection', (selector, expected) => {
    const {basic, output} = setup();
    basic.run(
      `10 ON ${selector} GOTO 100,200,300:PRINT "never"\n100 PRINT "one":END\n200 PRINT "two":END\n300 PRINT "three":END`,
    );
    expect(output).toEqual([expected + '\n']);
  });

  it.each([-1.9, -0.1, 0, 0.999, 4, 1e300])(
    'rejects out-of-list selector %s at its source span',
    (selector) => {
      const {basic, output} = setup();
      const source = `10 PRINT "before":ON ${selector} GOSUB 100,100,100:PRINT "never"\n100 RETURN`;
      const d = failure(() => basic.run(source), 'DISPATCH_RANGE');
      expect(d.column).toBe(source.indexOf('ON ') + 4);
      expect(output).toEqual(['before\n']);
      expect(basic.run('10 ON 1 GOSUB 100:END\n100 RETURN').status).toBe('halted');
    },
  );

  it('evaluates a selector once, left to right and never evaluates unchosen clauses', () => {
    const sequence = [0.2, 0.4];
    let reads = 0;
    const {basic, output} = setup({random: () => sequence[reads++]});
    basic.run(
      '10 IF 1=2 THEN ON RND() GOTO 100 ELSE ON 1+RND()+RND() GOTO 100,200\n100 PRINT "one":END\n200 PRINT "two":END',
    );
    expect(reads).toBe(2);
    expect(output).toEqual(['one\n']);
  });

  it('returns from selected nested calls to real same-line and conditional continuations', () => {
    const {basic, output} = setup();
    basic.run(
      '10 ON 2.9 GOSUB 100,110:PRINT "tail"\n20 IF 1=1 THEN ON 1 GOSUB 100 ELSE PRINT "wrong":PRINT "wrong"\n30 IF 1=2 THEN PRINT "wrong" ELSE ON 1 GOSUB 100:PRINT "last":END\n100 PRINT "one":RETURN\n110 PRINT "two":ON 1 GOSUB 100:RETURN',
    );
    expect(output.join('')).toBe('two\none\ntail\none\none\nlast\n');
    basic.run();
    expect(output.join('')).toBe(
      'two\none\ntail\none\none\nlast\ntwo\none\ntail\none\none\nlast\n',
    );
  });

  it('shares values/DATA and preserves caller loops while dropping early-return callee loops', () => {
    const {basic, output} = setup();
    basic.run(
      '10 N=0:FOR I=1 TO 2:ON I GOSUB 100,200:NEXT I:PRINT N;":";I;":";J:END\n100 FOR J=1 TO 2:READ D:N=N+D:RETURN:NEXT J\n200 ON 1 GOSUB 100:RETURN\n300 DATA 3,7',
    );
    expect(output.join('')).toBe('10:3:1\n');
  });

  it('uses selected literal locations for inactive-loop entry errors', () => {
    const {basic} = setup();
    const source = '10 ON 2 GOTO 40,30\n20 FOR I=1 TO 2\n30 NEXT I\n40 END';
    expect(failure(() => basic.run(source), 'LOOP_ENTRY')).toMatchObject({label: 10, column: 17});
    const call = source.replace('GOTO', 'GOSUB');
    expect(failure(() => basic.run(call), 'LOOP_ENTRY')).toMatchObject({label: 10, column: 18});
    failure(
      () => basic.run('10 FOR I=1 TO 2:ON 1 GOSUB 100:NEXT I:END\n100 FOR I=1 TO 2:NEXT I:RETURN'),
      'LOOP_VARIABLE_ACTIVE',
    );
    failure(
      () => basic.run('10 FOR I=1 TO 2\n20 ON 1 GOSUB 100\n30 NEXT I\n40 END\n100 ON 1 GOTO 30'),
      'LOOP_ENTRY',
    );
  });

  it('discards departed GOTO loop frames and allows later fresh loop entry', () => {
    const {basic, output} = setup();
    basic.run(
      '10 N=0\n20 FOR I=1 TO 2\n30 N=N+1:ON 1 GOTO 50\n40 NEXT I\n50 IF N<2 THEN 20\n60 PRINT N;":";I',
    );
    expect(output.join('')).toBe('2:1\n');
  });

  it('permits duplicate targets and returns to natural program end', () => {
    const {basic, output} = setup();
    basic.run('10 GOTO 100\n20 PRINT "sub":RETURN\n100 ON 2 GOSUB 20,20');
    expect(output.join('')).toBe('sub\n');
    basic.run('10 ON 1 GOSUB 100:PRINT "never"\n100 END');
    basic.run('10 ON 1 GOSUB 100:PRINT "never"\n100 PRINT "falloff"');
    expect(output.join('')).toBe('sub\nfalloff\n');
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
  });

  it.each([
    '10 ON',
    '10 ON 1',
    '10 ON 1 GOTO',
    '10 ON 1 GOSUB',
    '10 ON 1 GOTO 20,',
    '10 ON 1 GOTO ,20',
    '10 ON 1 GOTO 20,,30',
    '10 ON 1 GOTO 20+1',
    '10 ON 1 GOTO N',
    '10 ON 1 GOTO -20',
    '10 ON 1 GOTO 0',
    '10 ON 1 GOTO 65536',
    '10 ON 1 GOTO 2e1',
    '10 ON 1 GOTO 20.0',
    '10 ON 1 GO TO 20',
    '10 ON 1 GO SUB 20',
    '10 GOTO 1 OF 20',
    '10 ON1GOTO20',
  ])('rejects malformed/unsupported syntax %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it.each([
    ['10 PRINT "never":END:ON 1 GOTO 10,999', 'MISSING_TARGET'],
    ['10 PRINT "never":IF 1=2 THEN ON 1 GOSUB 999 ELSE END', 'MISSING_TARGET'],
    ['10 PRINT "never":END:ON "a" GOTO 10', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:ON S$ GOSUB 10', 'TYPE_MISMATCH'],
    ['10 PRINT "never":END:ON A(0) GOTO 10', 'UNDECLARED_ARRAY'],
    ['10 PRINT "never":END:ON KEYDOWN(1) GOTO 10', 'TYPE_MISMATCH'],
  ])('preflights every target and selector before effects %s', (source, code) => {
    const {basic, output} = setup();
    basic.run('10 PRINT "kept"');
    output.length = 0;
    failure(() => basic.run(source), code);
    expect(output).toEqual([]);
    basic.run();
    expect(output).toEqual(['kept\n']);
  });

  it('locates dead missing targets and runtime selector evaluation failures', () => {
    const source = '10 END:ON 1 GOTO 10,999';
    expect(failure(() => parseProgram(source), 'MISSING_TARGET').column).toBe(
      source.indexOf('999') + 1,
    );
    const {basic} = setup();
    const mixed = '10 S$="x":ON 1+S$ GOTO 10';
    expect(failure(() => basic.run(mixed), 'TYPE_MISMATCH').column).toBe(mixed.indexOf('+') + 1);
    failure(() => basic.run('10 ON MISSING GOTO 10'), 'UNDEFINED_VARIABLE');
    failure(() => basic.run('10 ON 1/0 GOTO 10'), 'DIVISION_BY_ZERO');
  });

  it('validates selection boundary value types and rejects nonfinite values without coercion', () => {
    const statement = dispatch();
    failure(() => dispatchTarget(statement, '1'), 'TYPE_MISMATCH');
    for (const value of [NaN, Infinity, -Infinity])
      failure(() => dispatchTarget(statement, value), 'DISPATCH_RANGE');
    expect(dispatchTarget(statement, 2.99).value).toBe(30);
  });

  it('copies caller lists and expressions without retaining/freezing caller-owned objects', () => {
    const mutable = structuredClone(parseProgram('10 ON 1 GOSUB 100,100:END\n100 RETURN').lines);
    const sequence = mutable[0].statement;
    if (sequence.type !== 'StatementSequence' || sequence.statements[0].type !== 'OnStatement')
      throw Error('Expected ON');
    const statement = sequence.statements[0];
    const snapshot = validateProgram(mutable);
    Reflect.set(statement.targets[0], 'value', 200);
    Reflect.set(statement.selector, 'value', 2);
    expect(Object.isFrozen(statement.targets)).toBe(false);
    expect(snapshot.lines[0].statement).toMatchObject({
      statements: [
        {selector: {value: 1}, targets: [{value: 100}, {value: 100}]},
        {type: 'EndStatement'},
      ],
    });
    const {basic} = setup();
    expect(basic.run(snapshot).status).toBe('halted');
  });

  it('enforces inclusive target-count bounds in source and constructed trees', () => {
    const accepted = `10 ON 4096 GOTO ${new Array<string>(4096).fill('20').join(',')}\n20 END`;
    const {basic} = setup();
    expect(basic.run(accepted).status).toBe('halted');
    const rejected = accepted.replace('\n20 END', ',20\n20 END');
    const d = failure(() => parseProgram(rejected), 'DISPATCH_LIMIT');
    expect(d.column).toBe(rejected.indexOf('\n') - 1);
    const lines = structuredClone(parseProgram(accepted).lines);
    const statement = lines[0].statement;
    if (statement.type !== 'OnStatement') throw Error('Expected ON');
    Reflect.set(statement, 'targets', [...statement.targets, statement.targets[0]]);
    failure(() => validateProgram(lines), 'DISPATCH_LIMIT');
  });

  it.each([
    ['transfer', 'jump', 'INVALID_DISPATCH'],
    ['targets', [], 'INVALID_DISPATCH'],
    ['targets', null, 'INVALID_DISPATCH'],
    ['selector', null, 'INVALID_DISPATCH'],
    ['targets', [null], 'INVALID_TARGET'],
    ['targets', [{type: 'Variable', name: 'N'}], 'INVALID_TARGET'],
    ['targets', [{type: 'NumberLiteral', value: 0, raw: '0'}], 'INVALID_TARGET'],
    ['targets', [{type: 'NumberLiteral', value: 20, raw: '21'}], 'INVALID_TARGET'],
    ['targets', [{type: 'NumberLiteral', value: 20, raw: '2e1'}], 'INVALID_TARGET'],
  ])('rejects malformed constructed %s', (key, value, code) => {
    const line = structuredClone(parseLine('10 ON 1 GOTO 10')!);
    Reflect.set(line.statement, key, value);
    failure(() => validateProgram([line]), code);
  });

  it('allows exactly 1024 selected calls, rejects the next and clears every frame', async () => {
    const {basic, output} = setup();
    const source =
      '10 N=0:ON 1 GOSUB 100:PRINT N:END\n100 N=N+1:IF N=1024 THEN RETURN\n110 ON 1 GOSUB 100:RETURN';
    await basic.runAsync(source, {instructionLimit: 6000});
    expect(output.join('')).toBe('1024\n');
    expect(
      await watch(basic.runAsync(source.replace('N=1024', 'N=1025'), {instructionLimit: 6000})),
    ).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({code: 'CALL_STACK_LIMIT', label: 110, column: 5});
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
  });

  it('steps at real successors and counts selector-plus-transfer as one unit', async () => {
    const {basic, output} = setup();
    const source = '10 ON 1 GOSUB 100:PRINT "done":END\n100 RETURN';
    basic.reset(source);
    expect(basic.step().nextLocation).toMatchObject({label: 100, start: {column: 5}});
    expect(basic.step().nextLocation).toMatchObject({label: 10, start: {column: 19}});
    let gates = 0;
    await basic.runAsync(source, {
      instructionLimit: 4,
      beforeStatement: () => {
        gates++;
      },
    });
    expect(gates).toBe(4);
    expect(output).toEqual(['done\n']);
    expect(await watch(basic.runAsync(source, {instructionLimit: 1}))).toBeInstanceOf(
      BasicRuntimeError,
    );
    expect(basic.state.diagnostic).toMatchObject({code: 'INSTRUCTION_LIMIT', label: 100});
  });

  it('retains selected call state through INPUT and WAIT across async steps', async () => {
    const {basic, output} = setup({
      readLine: () => Promise.resolve('4'),
      wait: () => Promise.resolve(),
    });
    basic.reset('10 ON 1 GOSUB 100:PRINT N+1:END\n100 INPUT N:WAIT 0:RETURN');
    await basic.stepAsync();
    await basic.stepAsync();
    await basic.stepAsync();
    expect((await basic.stepAsync()).nextLocation).toMatchObject({label: 10, start: {column: 19}});
    await basic.stepAsync();
    await basic.stepAsync();
    expect(output.join('')).toBe('5\n');
  });

  it('cancels selected subroutine work and ignores stale replies after replacement', async () => {
    let reply!: (text: string) => void;
    const {basic, output} = setup({
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
    });
    const old = watch(
      basic.runAsync('10 FOR I=1 TO 2:ON 1 GOSUB 100:NEXT I:END\n100 INPUT N:RETURN'),
    );
    while (basic.status !== 'waiting') await Promise.resolve();
    await basic.runAsync('10 FOR I=1 TO 1:NEXT I:PRINT "fresh":END');
    reply('9');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(output).toEqual(['fresh\n']);
    let yields = 0;
    const cancelled = await watch(
      basic.runAsync('10 ON 1 GOSUB 10', {
        yieldEvery: 4,
        scheduler: () => {
          yields++;
          basic.cancel();
          return Promise.resolve();
        },
      }),
    );
    expect(cancelled).toMatchObject({name: 'AbortError'});
    expect(yields).toBe(1);
    failure(() => basic.run('10 RETURN'), 'RETURN_WITHOUT_GOSUB');
  });

  it('isolates selected call frames and values between independently stepped instances', () => {
    const a = setup(),
      b = setup();
    const source = '10 N=1:ON N GOSUB 100:N=N+1:PRINT N:END\n100 RETURN';
    a.basic.reset(source);
    a.basic.step();
    a.basic.step();
    b.basic.run(source);
    a.basic.step();
    a.basic.step();
    a.basic.step();
    a.basic.step();
    expect(a.output).toEqual(['2\n']);
    expect(b.output).toEqual(['2\n']);
  });

  it.each(['10 ON RND() GOTO 100', '10 ON RND() GOSUB 100'])(
    'rejects immediate %s before selector/host effects',
    async (source) => {
      let random = 0;
      const {basic, output} = setup({
        random: () => {
          random++;
          return 0.5;
        },
      });
      failure(() => basic.readLine(source), 'PROGRAM_REQUIRED');
      basic.reset();
      expect(await watch(basic.readLineAsync(source))).toBeInstanceOf(BasicRuntimeError);
      expect(basic.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
      expect(random).toBe(0);
      expect(output).toEqual([]);
    },
  );
});
