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

const retry = 'Invalid input; enter 2 comma-separated values.\n';
function setup(answers: (string | null)[] = [], host: Partial<Host> = {}) {
  const output: string[] = [],
    prompts: string[] = [];
  const basic = new Basic({
    write: (text) => output.push(text),
    readLine(prompt) {
      prompts.push(prompt ?? '');
      return Promise.resolve(answers.shift() ?? null);
    },
    ...host,
  });
  return {basic, output, prompts};
}
const watch = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);
function syntax(action: () => unknown, code: string) {
  try {
    action();
    throw Error('Expected failure');
  } catch (error) {
    if (!(error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
  }
}

describe('native INPUT targets and rows', () => {
  it('keeps legacy scalar ASTs and locates immutable new list/indexed targets', () => {
    expect(parseLine('10 INPUT N')?.statement).toMatchObject({
      type: 'InputStatement',
      target: {type: 'Variable', name: 'N'},
    });
    const source = '\t020 input "Say ""Hi"""; i, a(i+1,2), s$';
    const line = parseLine(source, {line: 3, offset: 50})!;
    expect(line.statement).toMatchObject({
      type: 'InputTargetsStatement',
      prompt: {value: 'Say "Hi"', raw: '"Say ""Hi"""'},
      targets: [
        {
          type: 'Variable',
          name: 'I',
          location: {
            start: {line: 3, column: source.indexOf('i,') + 1, offset: 50 + source.indexOf('i,')},
          },
        },
        {type: 'ArrayReference', name: 'A', indices: [{type: 'BinaryExpression'}, {value: 2}]},
        {type: 'Variable', name: 'S$'},
      ],
    });
    expect(Object.isFrozen(line.statement)).toBe(true);
    expect(parseLine('10 INPUT A(0)')?.statement).toMatchObject({
      type: 'InputTargetsStatement',
      targets: [{type: 'ArrayReference', name: 'A'}],
    });
  });

  it.each([
    '10 INPUT A,',
    '10 INPUT ,A',
    '10 INPUT A,,B',
    '10 INPUT A;B',
    '10 INPUT A(0),3',
    '10 INPUT A()',
    '10 INPUT A(1,2,3)',
    '10 INPUT A+1,B',
    '10 INPUT "x",A,B',
    '10 INPUT "x";',
    '10 INPUT LINE A$',
    '10 LINPUT A$',
    '10 INPUTA,B',
  ])('rejects malformed/unsupported source %s', (text) => {
    expect(() => parseLine(text)).toThrow(BasicSyntaxError);
  });

  it('decodes mixed rows, quoted commas/doubled quotes/numbers and ordinary backslashes/apostrophes', async () => {
    const {basic, output, prompts} = setup([
      ' +.5e2 , " hi, ""Jesse"" ", \\Q O\'Neil ',
      '" -2e-1 ",tail',
    ]);
    await basic.runAsync(
      '10 INPUT "Pair";N,S$,T$:PRINT N;":";S$;":";T$\n20 INPUT N,S$:PRINT N;":";S$',
    );
    expect(output).toEqual(['50: hi, "Jesse" :\\Q O\'Neil\n', '-0.2:tail\n']);
    expect(prompts).toEqual(['Pair? ', '? ']);
  });

  it.each([',', '"",', ',""', '  , \t ', '"", ""'])(
    'accepts empty string fields: %s',
    async (response) => {
      const {basic, output} = setup([response]);
      await basic.runAsync('10 INPUT A$,B$:PRINT "[";A$;"][";B$;"]"');
      expect(output).toEqual(['[][]\n']);
    },
  );

  it.each([
    '',
    '1',
    '1,2,3',
    '1,',
    '1,NaN',
    '1,Infinity',
    '1,0x10',
    '1,2oops',
    '1,1e999',
    '1,1e',
    '1,1e+',
    '1,1_000',
    '1,"2',
    '1,2"',
    '"1"x,2',
    '"1" "x",2',
    '1,"2" x',
    '1,2\n',
    '1,"2\r"',
  ])('retries the whole numeric row with no partial assignment: %s', async (response) => {
    let reads = 0;
    const {basic, output, prompts} = setup([], {
      readLine(prompt) {
        prompts.push(prompt ?? '');
        expect(basic.variables).toEqual([
          {name: 'A', value: 7},
          {name: 'B', value: 8},
        ]);
        return Promise.resolve(reads++ === 0 ? response : '2,3');
      },
    });
    await basic.runAsync('10 A=7:B=8\n20 INPUT "Pair";A,B\n30 PRINT A;B');
    expect(reads).toBe(2);
    expect(prompts).toEqual(['Pair? ', 'Pair? ']);
    expect(output).toEqual([retry, '23\n']);
  });

  it('retains the entire raw response for a single scalar or array string target', async () => {
    const response = '  "raw, \\Q" , tail  ';
    const {basic, output} = setup([response, response, 'bad', ' -2.5e1 ']);
    await basic.runAsync(
      '10 DIM A$(0),A(0):INPUT S$:INPUT A$(0):INPUT A(0):PRINT S$;"|";A$(0);":";A(0)',
    );
    expect(output).toEqual([
      'Invalid number; please enter a finite decimal.\n',
      response + '|' + response + ':-25\n',
    ]);
  });

  it('evaluates indices only after a valid row, once each, after earlier target assignments', async () => {
    let reads = 0,
      random = 0;
    const {basic, output} = setup([], {
      random() {
        random++;
        return 0;
      },
      readLine() {
        expect(basic.variables).toEqual([{name: 'I', value: 0}]);
        expect(random).toBe(0);
        return Promise.resolve(reads++ === 0 ? '2,bad' : '2,9');
      },
    });
    await basic.runAsync('10 DIM A(2):I=0\n20 INPUT I,A(I+RND())\n30 PRINT I;":";A(2)');
    expect(random).toBe(1);
    expect(output).toEqual([retry, '2:9\n']);
  });

  it('preserves earlier writes on a commit-time bounds error, located at the index', async () => {
    const {basic, output, prompts} = setup(['2,9']);
    const text = '10 DIM A(0):INPUT I,A(I)';
    expect(await watch(basic.runAsync(text))).toBeInstanceOf(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({
      code: 'ARRAY_BOUNDS',
      label: 10,
      column: text.lastIndexOf('(I)') + 2,
    });
    expect(basic.variables).toEqual([{name: 'I', value: 2}]);
    expect(basic.arrays[0].values).toEqual([0]);
    expect(prompts).toHaveLength(1);
    expect(output).toEqual([]);
  });

  it('guards reset/cancel/run during post-await array-index host calls', async () => {
    const attempts: string[] = [];
    const {basic, output} = setup(['4,9'], {
      random() {
        for (const action of [
          () => basic.reset(),
          () => basic.cancel(),
          () => basic.run('10 PRINT "wrong"'),
        ])
          try {
            action();
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            attempts.push(error.message);
          }
        return 0;
      },
    });
    await basic.runAsync('10 DIM A(0):INPUT N,A(RND()):PRINT N;A(0)');
    expect(attempts).toEqual(
      new Array<string>(3).fill('Cannot change execution during a statement'),
    );
    expect(output).toEqual(['49\n']);
  });

  it.each([
    ['10 PRINT "never":END:INPUT A(0)', 'UNDECLARED_ARRAY'],
    ['10 DIM A(0):END:INPUT A(0,0)', 'ARRAY_RANK_MISMATCH'],
    ['10 DIM A(0):END:INPUT A("x")', 'TYPE_MISMATCH'],
  ])('validates unreachable array targets before prompting: %s', async (text, code) => {
    const {basic, output, prompts} = setup(['1']);
    basic.run('10 PRINT "kept"');
    output.length = 0;
    expect(await watch(basic.runAsync(text))).toMatchObject({diagnostic: {code}});
    expect(prompts).toEqual([]);
    expect(output).toEqual([]);
    basic.run();
    expect(output).toEqual(['kept\n']);
  });

  it('rejects malformed and over-limit constructed target lists before effects', () => {
    const line = parseLine('10 INPUT A,B')!;
    if (line.statement.type !== 'InputTargetsStatement') throw Error('Expected targets');
    for (const targets of [[], null, [null], [{type: 'NumberLiteral', value: 1}]]) {
      const candidate = structuredClone(line);
      Reflect.set(candidate.statement, 'targets', targets);
      syntax(() => validateProgram([candidate]), 'INVALID_INPUT');
    }
    const tooMany = structuredClone(line);
    Reflect.set(tooMany.statement, 'targets', new Array(4097).fill(line.statement.targets[0]));
    syntax(() => validateProgram([tooMany]), 'INPUT_LIMIT');
  });

  it('accepts exactly 4096 targets/fields and rejects a longer source list', async () => {
    const targets = new Array(4096).fill('A').join(',');
    syntax(() => parseLine('10 INPUT ' + targets + ',A'), 'INPUT_LIMIT');
    const {basic} = setup([
      new Array(4097).fill('0').join(','),
      new Array(4096).fill('1').join(','),
    ]);
    await basic.runAsync('10 INPUT ' + targets);
    expect(basic.variables).toEqual([{name: 'A', value: 1}]);
  });

  it('bounds multi-target responses at exactly 65536 UTF-16 units', async () => {
    const {basic} = setup(['x'.repeat(65534) + ',z', 'x'.repeat(65535) + ',z']);
    await basic.runAsync('10 INPUT A$,B$');
    expect(basic.variables[0].value).toHaveLength(65534);
    expect(await watch(basic.runAsync('10 A$="kept":INPUT A$,B$'))).toMatchObject({
      diagnostic: {code: 'INPUT_LIMIT', label: 10, column: 14},
    });
    expect(basic.variables).toEqual([{name: 'A$', value: 'kept'}]);
  });

  it('copies caller-owned targets before waiting and never changes a prepared snapshot', async () => {
    let reply!: (text: string) => void;
    const mutable = structuredClone(parseProgram('10 INPUT A,B:PRINT A;B').lines);
    const {basic, output} = setup([], {
      readLine: () =>
        new Promise<string>((resolve) => {
          reply = resolve;
        }),
    });
    basic.reset({type: 'Program', lines: mutable});
    const step = basic.stepAsync();
    const sequence = mutable[0].statement;
    if (
      sequence.type !== 'StatementSequence' ||
      sequence.statements[0].type !== 'InputTargetsStatement'
    )
      throw Error('Expected list');
    Reflect.set(sequence.statements[0].targets[0], 'name', 'C');
    reply('2,3');
    await step;
    basic.step();
    expect(output).toEqual(['23\n']);
  });

  it('keeps a list one statement across retries, gates and budgets in a subroutine with DATA', async () => {
    const {basic, output} = setup(['1', '2,3'], {wait: () => Promise.resolve()});
    let gates = 0;
    await basic.runAsync(
      '10 READ D:GOSUB 100:READ E:PRINT A;B;D;E:END\n100 INPUT A,B:WAIT 0:RETURN\n200 DATA 4,5',
      {
        instructionLimit: 8,
        beforeStatement() {
          gates++;
        },
      },
    );
    expect(gates).toBe(8);
    expect(output).toEqual([retry, '2345\n']);
    expect(await watch(basic.runAsync('10 INPUT A,B', {instructionLimit: 0}))).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT'},
    });
  });

  it('reports EOF after a malformed row without committing any fields and reruns fresh', async () => {
    const {basic, output, prompts} = setup(['2,bad', null, '4,5']);
    expect(await watch(basic.runAsync('10 A=7:B=8\n20 INPUT A,B:PRINT "never"'))).toMatchObject({
      diagnostic: {code: 'INPUT_ENDED', label: 20, column: 4},
    });
    expect(basic.variables).toEqual([
      {name: 'A', value: 7},
      {name: 'B', value: 8},
    ]);
    expect(prompts).toHaveLength(2);
    await basic.runAsync('10 INPUT A,B:PRINT A;B');
    expect(output).toEqual([retry, '45\n']);
  });

  it('cancels during a list retry before the host is asked again', async () => {
    const controller = new AbortController();
    let reads = 0;
    const {basic} = setup([], {
      readLine() {
        reads++;
        return Promise.resolve('bad');
      },
      write() {
        controller.abort();
      },
    });
    expect(await watch(basic.runAsync('10 INPUT A,B', {signal: controller.signal}))).toMatchObject({
      name: 'AbortError',
    });
    expect(reads).toBe(1);
    expect(basic.variables).toEqual([]);
  });

  it('isolates pending instances and discards late replies after replacement/Stop', async () => {
    const replies: ((text: string) => void)[] = [];
    const host = {readLine: () => new Promise<string>((resolve) => replies.push(resolve))};
    const a = setup([], host),
      b = setup([], host);
    const old = watch(a.basic.runAsync('10 INPUT A,B:PRINT "old"'));
    const other = b.basic.runAsync('10 INPUT A,B:PRINT A;B');
    replies[1]('7,8');
    await other;
    a.basic.run('10 N=9:PRINT N');
    replies[0]('1,2');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(a.output).toEqual(['9\n']);
    expect(a.basic.variables).toEqual([{name: 'N', value: 9}]);
    expect(b.output).toEqual(['78\n']);
    const stopped = watch(a.basic.runAsync('10 INPUT A,B'));
    a.basic.cancel();
    replies[2]('1,2');
    expect(await stopped).toMatchObject({name: 'AbortError'});
    expect(a.basic.variables).toEqual([]);
  });

  it('guards synchronous input-provider reentry and permits recovery', async () => {
    let once = true;
    const {basic, output} = setup([], {
      readLine() {
        if (once) {
          once = false;
          basic.run('10 N=9:PRINT N');
        }
        return Promise.resolve('1,2');
      },
    });
    expect(await watch(basic.runAsync('10 INPUT A,B'))).toMatchObject({
      diagnostic: {code: 'INPUT_FAILED'},
    });
    // Synchronous provider callbacks are guarded before they can replace a run.
    expect(output).toEqual([]);
    expect(basic.variables).toEqual([]);
    await basic.runAsync('10 INPUT A,B:PRINT A;B');
    expect(output).toEqual(['12\n']);
  });

  it('discards a response when an asynchronous provider replaces its own waiting run', async () => {
    const {basic, output} = setup([], {
      readLine() {
        return Promise.resolve().then(() => {
          basic.run('10 N=9:PRINT N');
          return '1,2';
        });
      },
    });
    expect(await watch(basic.runAsync('10 INPUT A,B:PRINT "old"'))).toMatchObject({
      name: 'AbortError',
    });
    expect(basic.variables).toEqual([{name: 'N', value: 9}]);
    expect(output).toEqual(['9\n']);
  });

  it.each(['run', 'step', 'readLine'] as const)(
    'rejects synchronous %s lists before prompting',
    (method) => {
      const {basic, prompts} = setup(['1,2']);
      expect(() => {
        if (method === 'step') {
          basic.reset('10 INPUT A,B');
          basic.step();
        } else basic[method]('10 INPUT A,B');
      }).toThrow(BasicRuntimeError);
      expect(basic.state.diagnostic?.code).toBe('ASYNC_INPUT_REQUIRED');
      expect(prompts).toEqual([]);
    },
  );

  it('supports immediate scalar lists and rejects indexed immediate INPUT before prompting', async () => {
    const {basic, output, prompts} = setup(['2,hi']);
    await basic.readLineAsync('10 INPUT A,S$');
    await basic.readLineAsync('20 PRINT A;S$');
    expect(output).toEqual(['2hi\n']);
    basic.reset();
    expect(await watch(basic.readLineAsync('10 INPUT A(0)'))).toMatchObject({
      diagnostic: {code: 'PROGRAM_REQUIRED'},
    });
    expect(prompts).toHaveLength(1);
  });
});
