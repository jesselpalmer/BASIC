import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runArrayAcceptance} from './array-acceptance.ts';
import {
  runAdjacentPrintAcceptance,
  runPrintUsingAcceptance,
  runNativeCheckerAcceptance,
} from './output-acceptance.ts';
import type * as PublicApi from '../src/index.ts';
import type {GraphicsCommand, Host, LogicalKey} from '../src/index.ts';

type Api = Pick<
  typeof PublicApi,
  | 'Basic'
  | 'BasicSyntaxError'
  | 'BasicRuntimeError'
  | 'parseLine'
  | 'parseProgram'
  | 'validateProgram'
  | 'Evaluator'
>;

export const libraryAcceptanceCases = [
  'public program execution and stepping',
  'common classic spellings preserve native names and execution',
  'unchanged 23 Matches loss/replay path and explicit native RNG limit',
  'public parser snapshots and diagnostics',
  'explicit native context rejects unsupported program metadata before effects',
  'explicit arrays execute board moves, enforce bounds, and isolate fresh runs',
  'string-involved PRINT adjacency preserves expressions, names, and atomic writes',
  'native integer PRINT USING preserves names, alignment, and errors',
  'reviewed 1CHECK correction executes native moves, retry, replay, and normal exit',
  'scientific literals and powers execute corpus formulas with bounded failures',
  'statement sequences preserve positions, line scope and preflight validation',
  'literal subroutines preserve caller loops, shared values and real return positions',
  'native data pools preserve corpus literals, sequential reads and fresh cursors',
  'public evaluator values and diagnostics',
  'greeting preserves input',
  'guessing game and fresh rerun',
  'times-table example',
  'graphics primitives and unsupported host diagnostics',
  'cooperative WAIT, stepping, and cancellation',
  'logical keyboard input and unsupported hosts',
  'packaged Pong starts, renders, cancels and reruns',
  'stepping, reset, and instance isolation',
  'source-located syntax and runtime failures',
  'arithmetic and string failures preserve diagnostics and allow recovery',
  'numeric retry and input EOF',
  'cancellation and late reply',
  'replacement run isolates old input',
  'nested, descending, empty, and inactive loops',
  'instruction limits and cooperative batches',
  'replacement run isolates a pending scheduler',
] as const;

// Runtime code comes only from the supplied module. Type imports disappear when
// this harness is copied into the isolated installed-package consumer.
export async function runLibraryAcceptance(api: Api, examplesDirectory: string): Promise<string[]> {
  const completed: string[] = [];
  const fixture = (name: string) => readFileSync(join(examplesDirectory, name), 'utf8');
  async function check(
    name: (typeof libraryAcceptanceCases)[number],
    action: () => void | Promise<void>,
  ) {
    try {
      await action();
      completed.push(name);
    } catch (cause) {
      throw new Error(`Library acceptance failed: ${name}`, {cause});
    }
  }
  function setup(answers: (string | null)[] = [], host: Partial<Host> = {}) {
    const remaining = [...answers];
    const output: string[] = [];
    const prompts: string[] = [];
    const basic = new api.Basic({
      write: (text) => output.push(text),
      readLine(prompt) {
        prompts.push(prompt ?? '');
        return Promise.resolve(remaining.shift() ?? null);
      },
      random: () => 0.41,
      ...host,
    });
    return {basic, output, prompts, remaining};
  }
  function pending() {
    const requests: {reply: (value: string | null) => void; signal?: AbortSignal}[] = [];
    const result = setup([], {
      readLine(_prompt, options) {
        return new Promise<string | null>((reply) => {
          requests.push({reply, signal: options?.signal});
        });
      },
    });
    return {...result, requests};
  }

  await check('public program execution and stepping', () => {
    const {basic, output} = setup();
    basic.run(
      '50 END\n40 PRINT "package "; A\n30 PRINT "skipped"\n20 IF A=6 THEN 40\n10 LET A = INT(2.9)*3',
    );
    basic.run('10 GOTO 30\n20 PRINT "skipped"\n30 REM');
    basic.reset(api.parseProgram('10 PRINT "step"'));
    const result = basic.step();
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 10);
    assert.equal(result.nextLocation, null);
    assert.ok(Object.isFrozen(result));
    basic.run('10 FOR I=1 TO 2\n20 PRINT I;\n30 NEXT I\n40 PRINT I');
    assert.equal(output.join(''), 'package 6\nstep\n123\n');
  });
  await check('common classic spellings preserve native names and execution', () => {
    const source = [
      '10 go=4',
      '20 LET TOGETHER=GO+1',
      '30 GO TO 50',
      '40 PRINT "skipped"',
      '50 PRINT GO;":";TOGETHER',
      '60 END',
    ].join('\n');
    const {basic, output} = setup();
    const program = api.parseProgram(source);
    assert.equal(program.lines[0].source, '10 go=4');
    assert.equal(program.lines[2].source, '30 GO TO 50');
    basic.run(program);
    basic.run();
    assert.equal(output.join(''), '4:5\n4:5\n');
    assert.deepEqual(basic.variables, [
      {name: 'GO', value: 4},
      {name: 'TOGETHER', value: 5},
    ]);
  });
  await check('unchanged 23 Matches loss/replay path and explicit native RNG limit', async () => {
    const source = readFileSync(
      new URL('./package/fixtures/classic/23mtch.bas', import.meta.url),
      'utf8',
    );
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      '6406621c19cfac9961d0b4fa36ba50d322f4697648b1021fe99cace6ef9d8896',
      'The historical fixture must retain its pinned source bytes',
    );
    const {basic, output, prompts} = setup(Array<string>(7).fill('1'));
    // This source replays forever. EOF at the next round's prompt bounds the
    // observation without changing the game or manufacturing a terminating END.
    await assert.rejects(basic.runAsync(source, {instructionLimit: 500}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 230);
      return true;
    });
    const text = output.join('');
    assert.deepEqual(
      [...text.matchAll(/THERE ARE NOW(\d+)MATCHES\./g)].map((match) => Number(match[1])),
      [23, 21, 17, 13, 9, 5, 1, 23],
    );
    assert.deepEqual(
      [...text.matchAll(/I TOOK(\d+)\.\.\./g)].map((match) => Number(match[1])),
      [1, 3, 3, 3, 3, 3],
    );
    assert.equal(text.split('I WON!! BETTER LUCK NEXT TIME.').length - 1, 1);
    assert.equal(prompts.length, 8);
    assert.ok(basic.variables.some(({name, value}) => name === 'M' && value === 23));
    // The other branch remains a compatibility blocker, rather than being
    // skipped or rewritten to the native zero-argument random function.
    const blocked = setup(['2']);
    await assert.rejects(
      blocked.basic.runAsync(source, {instructionLimit: 500}),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'INVALID_ARGUMENT_COUNT');
        assert.equal(error.diagnostic.label, 330);
        return true;
      },
    );
    basic.run('10 recovered$="after game"\n20 PRINT recovered$');
    assert.ok(output.join('').endsWith('after game\n'));
  });
  await check('public parser snapshots and diagnostics', () => {
    const program = api.parseProgram('20 END\n10 LET A = 1+2*3');
    const first = program.lines[0];
    assert.equal(first.label, 10);
    assert.ok(first.statement.type === 'LetStatement');
    assert.ok(first.statement.expression.type === 'BinaryExpression');
    assert.ok(first.statement.expression.right.type === 'BinaryExpression');
    assert.equal(first.statement.expression.right.operator, '*');
    const replacement = api.parseLine('10 PRINT A;');
    assert.ok(replacement);
    const edited = api.validateProgram([program.lines[1], replacement]);
    assert.ok(edited.lines[0].statement.type === 'PrintStatement');
    assert.equal(edited.lines[0].statement.trailingSemicolon, true);
    assert.ok(Object.isFrozen(edited.lines[0].statement.items));
    assert.throws(
      () => api.parseProgram('10 PRINT 1+'),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicSyntaxError);
        assert.equal(error.diagnostic.code, 'EXPECTED_EXPRESSION');
        assert.equal(error.diagnostic.label, 10);
        return true;
      },
    );
  });
  await check(
    'explicit native context rejects unsupported program metadata before effects',
    async () => {
      const options = {dialect: 'native'} as const;
      const output: string[] = [];
      const basic = new api.Basic({write: (text) => output.push(text)}, options);
      const evaluator = new api.Evaluator({}, options);
      const program = api.parseProgram('10 VALUE=4\n20 PRINT VALUE', options);
      assert.equal(program.dialect, 'native');
      assert.equal(program.lines[0].dialect, 'native');
      assert.equal(basic.dialect, 'native');
      assert.equal(evaluator.dialect, 'native');
      const legacy = {
        type: 'Program' as const,
        lines: program.lines.map(({dialect, ...line}) => {
          assert.equal(dialect, 'native');
          return line;
        }),
      };
      const validated = api.validateProgram(legacy.lines, options);
      assert.equal(validated.dialect, 'native');
      assert.equal(validated.lines[0].dialect, 'native');
      basic.run(legacy);
      const foreign = {...program, dialect: 'basic-plus-1972'} as unknown as PublicApi.Program;
      assert.throws(() => basic.run(foreign), TypeError);
      await assert.rejects(basic.runAsync(foreign), TypeError);
      const mixed = {
        ...program,
        lines: [{...program.lines[0], dialect: 'basic-plus-1972'}, program.lines[1]],
      } as unknown as PublicApi.Program;
      assert.throws(() => basic.run(mixed), TypeError);
      assert.deepEqual(output, ['4\n']);
      basic.run();
      assert.deepEqual(output, ['4\n', '4\n']);
      assert.equal(Reflect.set(basic, 'dialect', 'basic-plus-1972'), false);
    },
  );
  await check('explicit arrays execute board moves, enforce bounds, and isolate fresh runs', () =>
    runArrayAcceptance(
      api,
      readFileSync(new URL('./package/fixtures/arrays/board.bas', import.meta.url), 'utf8'),
    ),
  );
  await check(
    'string-involved PRINT adjacency preserves expressions, names, and atomic writes',
    () => runAdjacentPrintAcceptance(api),
  );
  await check('native integer PRINT USING preserves names, alignment, and errors', () =>
    runPrintUsingAcceptance(api),
  );
  await check(
    'reviewed 1CHECK correction executes native moves, retry, replay, and normal exit',
    () => runNativeCheckerAcceptance(api),
  );
  await check(
    'scientific literals and powers execute corpus formulas with bounded failures',
    async () => {
      const source = readFileSync(
        join(import.meta.dirname, 'package/fixtures/numeric/formulas.bas'),
        'utf8',
      );
      const expected = 'constants=0.001:0.000884361\nheight=16\ndistance=13\npowers=-4:64:0.0625\n';
      const {basic, output} = setup();
      const program = api.parseProgram(source);
      assert.equal(basic.run(program).status, 'halted');
      assert.equal(output.join(''), expected);
      output.length = 0;
      await basic.runAsync();
      assert.equal(output.join(''), expected);
      assert.throws(() => basic.run('10 PRINT 1e+'), api.BasicSyntaxError);
      output.length = 0;
      basic.run();
      assert.equal(output.join(''), expected);
      output.length = 0;
      assert.throws(
        () => basic.run('10 PRINT "partial";2^1e300'),
        (error: unknown) =>
          error instanceof api.BasicRuntimeError && error.diagnostic.code === 'NON_FINITE_NUMBER',
      );
      assert.deepEqual(output, []);
      const input = setup(['1e+', '-2e1']);
      await input.basic.runAsync('10 INPUT N\n20 PRINT N^2');
      assert.equal(input.output.join(''), 'Invalid number; please enter a finite decimal.\n400\n');
      basic.run('10 DIM EXP(0)\n20 EXP=2\n30 EXP(0)=3\n40 PRINT EXP^EXP(0)');
      assert.deepEqual(output, ['8\n']);
    },
  );
  await check(
    'statement sequences preserve positions, line scope and preflight validation',
    async () => {
      const source = readFileSync(
        join(import.meta.dirname, 'package/fixtures/sequences/probe.bas'),
        'utf8',
      );
      const expected = 'take=4:0\nsum=9\nafter empty\ncounter=7\n1:2:done\n';
      const {basic, output} = setup();
      const program = api.parseProgram(source);
      assert.equal(program.lines[1].statement.type, 'StatementSequence');
      basic.reset(program);
      basic.step();
      basic.step();
      assert.equal(basic.state.nextLocation?.label, 20);
      assert.equal(basic.state.nextLocation?.start.column, 13);
      assert.equal(basic.run(program).status, 'halted');
      assert.equal(output.join(''), expected);
      output.length = 0;
      await basic.runAsync();
      assert.equal(output.join(''), expected);
      output.length = 0;
      assert.throws(() => basic.run('10 PRINT "never":END:GOTO 90'), api.BasicSyntaxError);
      assert.deepEqual(output, []);
      basic.run();
      assert.equal(output.join(''), expected);
      const input = setup(['4'], {wait: () => Promise.resolve()});
      await input.basic.runAsync('10 INPUT N:WAIT 0:PRINT N+1');
      assert.equal(input.output.join(''), '5\n');
      const limited = setup();
      await assert.rejects(
        limited.basic.runAsync('10 PRINT 1:PRINT 2:END', {instructionLimit: 1}),
        (error: unknown) =>
          error instanceof api.BasicRuntimeError &&
          error.diagnostic.code === 'INSTRUCTION_LIMIT' &&
          error.diagnostic.column === 12,
      );
      assert.deepEqual(limited.output, ['1\n']);
    },
  );
  await check(
    'literal subroutines preserve caller loops, shared values and real return positions',
    async () => {
      const source = readFileSync(
        join(import.meta.dirname, 'package/fixtures/subroutines/probe.bas'),
        'utf8',
      );
      const expected = 'take=4:0:3\nnested=4\n';
      const {basic, output} = setup();
      basic.run(api.parseProgram(source));
      assert.equal(output.join(''), expected);
      output.length = 0;
      await basic.runAsync();
      assert.equal(output.join(''), expected);
      basic.reset('10 GOSUB 100:PRINT "done":END\n100 RETURN');
      basic.step();
      assert.equal(basic.state.nextLocation?.label, 100);
      basic.step();
      assert.equal(basic.state.nextLocation?.label, 10);
      assert.equal(basic.state.nextLocation?.start.column, 14);
      const io = setup(['4'], {wait: () => Promise.resolve()});
      await io.basic.runAsync('10 GOSUB 100:PRINT N+1:END\n100 INPUT N:WAIT 0:RETURN');
      assert.equal(io.output.join(''), '5\n');
      output.length = 0;
      assert.throws(() => basic.run('10 PRINT "never":END:GOSUB 999'), api.BasicSyntaxError);
      assert.deepEqual(output, []);
      basic.run();
      assert.equal(output.join(''), 'done\n');
      assert.throws(
        () => basic.run('10 RETURN'),
        (error: unknown) =>
          error instanceof api.BasicRuntimeError &&
          error.diagnostic.code === 'RETURN_WITHOUT_GOSUB',
      );
      assert.throws(
        () => basic.run('10 FOR I=1 TO 2:GOSUB 100:NEXT I:END\n100 FOR I=1 TO 2:NEXT I:RETURN'),
        (error: unknown) =>
          error instanceof api.BasicRuntimeError &&
          error.diagnostic.code === 'LOOP_VARIABLE_ACTIVE',
      );
      output.length = 0;
      basic.run(
        '10 DIM GOSUB(0),RETURN(0):GOSUB=1:RETURN=2:GOSUB(0)=3:RETURN(0)=4:PRINT GOSUB;RETURN;GOSUB(0);RETURN(0)',
      );
      assert.equal(output.join(''), '1234\n');
    },
  );
  await check(
    'native data pools preserve corpus literals, sequential reads and fresh cursors',
    async () => {
      const source = readFileSync(
        join(import.meta.dirname, 'package/fixtures/data/probe.bas'),
        'utf8',
      );
      const expected = 'corners=1:43:4:\\AFISH\nreset=1:49\n';
      const {basic, output} = setup();
      basic.run(api.parseProgram(source));
      await basic.runAsync();
      assert.equal(output.join(''), expected + expected);
      output.length = 0;
      basic.reset('10 READ A,B:RESTORE:READ C:PRINT A;B;C:END\n20 DATA 2,3');
      basic.step();
      assert.deepEqual(basic.variables, [
        {name: 'A', value: 2},
        {name: 'B', value: 3},
      ]);
      assert.equal(basic.state.nextLocation?.start.column, 13);
      while (basic.status !== 'halted') basic.step();
      assert.equal(output.join(''), '232\n');
      const io = setup(['4'], {wait: () => Promise.resolve()});
      await io.basic.runAsync('10 READ A:INPUT N:WAIT 0:READ B:PRINT A;B:END\n20 DATA 2,3');
      assert.equal(io.output.join(''), '23\n');
      output.length = 0;
      assert.throws(() => basic.run('10 PRINT "never":END:READ M(0)'), api.BasicSyntaxError);
      assert.deepEqual(output, []);
      basic.run();
      assert.equal(output.join(''), '232\n');
      for (const [text, code] of [
        ['10 READ A,B\n20 DATA 1', 'OUT_OF_DATA'],
        ['10 READ A\n20 DATA "1"', 'TYPE_MISMATCH'],
        ['10 DIM A(0):READ A(1)\n20 DATA 2', 'ARRAY_BOUNDS'],
      ])
        assert.throws(
          () => basic.run(text),
          (error: unknown) =>
            error instanceof api.BasicRuntimeError && error.diagnostic.code === code,
        );
      assert.throws(() => api.parseLine('10 DATA 1:PRINT 2'), api.BasicSyntaxError);
      assert.throws(() => basic.run('10 RESTORE 20'), api.BasicSyntaxError);
      output.length = 0;
      basic.run(source);
      assert.equal(output.join(''), expected);
    },
  );
  await check('public evaluator values and diagnostics', () => {
    const evaluator = new api.Evaluator({random: () => 0.41});
    const assignment = api.parseLine('10 LET SECRET = INT(RND()*100)+1');
    assert.ok(assignment?.statement.type === 'LetStatement');
    evaluator.assign(
      assignment.statement.target,
      evaluator.evaluate(assignment.statement.expression),
    );
    const output = api.parseLine('20 PRINT SECRET+1');
    assert.ok(output?.statement.type === 'PrintStatement');
    const expression = output.statement.items[0];
    assert.equal(evaluator.evaluate(expression), 43);
    evaluator.reset();
    assert.throws(
      () => evaluator.evaluate(expression),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'UNDEFINED_VARIABLE');
        assert.equal(error.diagnostic.label, 20);
        assert.equal(error.diagnostic.column, 10);
        return true;
      },
    );
    const branch = api.parseLine('10 IF 1 < 2 THEN 20');
    assert.ok(branch?.statement.type === 'IfStatement');
    assert.ok(evaluator.compare(branch.statement.condition));
  });
  await check('greeting preserves input', async () => {
    const {basic, output, prompts, remaining} = setup(['  Ada LoveLace  ']);
    assert.equal((await basic.runAsync(fixture('greeting.bas'))).status, 'halted');
    assert.deepEqual(prompts, ['What is your name? ']);
    assert.deepEqual(output, ['Hello,   Ada LoveLace  !\n']);
    assert.deepEqual(remaining, []);
  });
  await check('guessing game and fresh rerun', async () => {
    let randomCalls = 0;
    const {basic, output, prompts, remaining} = setup(['20', '80', '42', '42'], {
      random() {
        randomCalls++;
        return 0.41;
      },
    });
    assert.equal((await basic.runAsync(fixture('guess.bas'))).status, 'halted');
    assert.deepEqual(output, ['Too low.\n', 'Too high.\n', 'Correct in 3 tries!\n']);
    assert.deepEqual(prompts, Array<string>(3).fill('Guess a number from 1 to 100? '));
    assert.equal(randomCalls, 1);
    output.length = 0;
    prompts.length = 0;
    assert.equal((await basic.runAsync()).status, 'halted');
    assert.deepEqual(output, ['Correct in 1 tries!\n']);
    assert.deepEqual(prompts, ['Guess a number from 1 to 100? ']);
    assert.equal(randomCalls, 2);
    assert.deepEqual(remaining, []);
  });
  await check('times-table example', async () => {
    const {basic, output, prompts} = setup(['3']);
    assert.equal((await basic.runAsync(fixture('times-table.bas'))).status, 'halted');
    assert.deepEqual(prompts, ['Which times table? ']);
    assert.deepEqual(
      output,
      Array.from({length: 10}, (_, i) => `${i + 1} x 3 = ${(i + 1) * 3}\n`),
    );
  });
  await check('graphics primitives and unsupported host diagnostics', () => {
    const commands: GraphicsCommand[] = [];
    const {basic, output} = setup([], {draw: (command) => commands.push(command)});
    assert.equal(basic.run(fixture('picture.bas')).status, 'halted');
    assert.equal(commands.length, 9);
    assert.deepEqual(commands[0], {kind: 'circle', x: 258, y: 42, radius: 22, color: 14});
    assert.deepEqual(commands[commands.length - 1], {kind: 'pset', x: 160, y: 116, color: 15});
    assert.deepEqual(output, []);
    basic.run('10 PSET 1,2');
    assert.equal(commands[commands.length - 1].color, 7);
    assert.throws(
      () => setup().basic.run('10 PSET 1,2'),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'GRAPHICS_UNAVAILABLE');
        assert.equal(error.diagnostic.label, 10);
        assert.equal(error.diagnostic.column, 4);
        return true;
      },
    );
  });
  await check('cooperative WAIT, stepping, and cancellation', async () => {
    const durations: number[] = [];
    const {basic, output} = setup([], {
      wait(milliseconds) {
        durations.push(milliseconds);
        return Promise.resolve();
      },
    });
    await basic.runAsync('10 WAIT .1\n20 WAIT 0\n30 PRINT "waited"');
    assert.deepEqual(durations, [1, 0]);
    assert.deepEqual(output, ['waited\n']);
    basic.reset('10 WAIT 2\n20 PRINT "after step"');
    const stepped = await basic.stepAsync();
    assert.equal(stepped.currentLocation?.label, 10);
    assert.equal(stepped.nextLocation?.label, 20);
    assert.deepEqual(output, ['waited\n']);
    basic.step();
    let ready!: () => void;
    const entered = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const pending = new api.Basic({
      wait(_ms, options) {
        signal = options?.signal;
        ready();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const old = pending.runAsync('10 WAIT 2147483647\n20 PRINT "old"');
    const rejected = assert.rejects(old, {name: 'AbortError'});
    await entered;
    pending.run('30 END');
    await rejected;
    assert.equal(signal?.aborted, true);
    const current = pending.state;
    release();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(pending.state, current);
    await assert.rejects(basic.runAsync('10 WAIT 2147483648'), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INVALID_WAIT_DURATION');
      assert.equal(error.diagnostic.column, 9);
      return true;
    });
    assert.equal((await new api.Basic().runAsync('10 WAIT 0')).status, 'halted');
  });
  await check('logical keyboard input and unsupported hosts', async () => {
    const keys: LogicalKey[] = ['A', 'LEFT'];
    const observations: LogicalKey[] = [];
    const {basic, output} = setup([], {
      readKey: () => keys.shift() ?? '',
      keyDown(key) {
        observations.push(key);
        return key === 'LEFT';
      },
    });
    basic.run('10 LET KEY$=INKEY$()\n20 PRINT KEY$;KEYDOWN(INKEY$());KEYDOWN("up");INKEY$()');
    assert.deepEqual(output, ['A10\n']);
    assert.deepEqual(observations, ['LEFT', 'UP']);
    assert.equal((await basic.runAsync('10 PRINT INKEY$()')).status, 'halted');
    assert.deepEqual(output, ['A10\n', '\n']);
    const unsupported = new api.Basic();
    assert.equal(unsupported.run('10 END\n20 PRINT INKEY$()').status, 'halted');
    for (const expression of ['INKEY$()', 'KEYDOWN("UP")']) {
      assert.throws(
        () => unsupported.run(`10 PRINT ${expression}`),
        (error: unknown) => {
          assert.ok(error instanceof api.BasicRuntimeError);
          assert.equal(error.diagnostic.code, 'KEYBOARD_UNAVAILABLE');
          assert.equal(error.diagnostic.column, 10);
          return true;
        },
      );
    }
    assert.throws(() => basic.run('10 END\n20 PRINT KEYDOWN(1)'), api.BasicSyntaxError);
  });
  await check('packaged Pong starts, renders, cancels and reruns', async () => {
    const source = fixture('pong.bas');
    let presented!: () => void;
    const commands: GraphicsCommand[] = [];
    const prompts: string[] = [];
    const basic = new api.Basic({
      write: () => {},
      clear: () => {
        commands.length = 0;
      },
      draw: (command) => commands.push(command),
      readLine: (prompt = '') => {
        prompts.push(prompt);
        return Promise.resolve('');
      },
      random: () => 0.25,
      keyDown: () => false,
      wait: (milliseconds) => {
        assert.equal(milliseconds, 16);
        presented();
        // No external resource is allocated; cancellation must still settle the run.
        return new Promise<void>(() => {});
      },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const frame = new Promise<void>((resolve) => {
        presented = resolve;
      });
      const running = basic.runAsync(source, {signal: controller.signal, instructionLimit: 1000});
      const cancelled = running.catch((error: unknown) => error);
      await frame;
      assert.ok(
        commands.some(
          (command) =>
            command.kind === 'circle' &&
            command.x === 160 &&
            command.y === 100 &&
            command.radius === 3,
        ),
      );
      assert.ok(
        commands.some(
          (command) => command.kind === 'line' && command.x1 === 16 && command.x2 === 16,
        ),
      );
      assert.ok(
        commands.some(
          (command) => command.kind === 'line' && command.x1 === 303 && command.x2 === 303,
        ),
      );
      controller.abort();
      const result: unknown = await cancelled;
      assert.ok(result instanceof Error && result.name === 'AbortError');
      assert.equal(basic.status, 'halted');
    }
    assert.equal(prompts.length, 2);
  });

  await check('stepping, reset, and instance isolation', () => {
    const first = setup();
    const second = setup();
    first.basic.reset('30 END\n20 PRINT A\n10 LET A=7');
    assert.deepEqual(first.output, []);
    const before = first.basic.state;
    const assigned = first.basic.step();
    assert.equal(assigned.currentLocation?.label, 10);
    assert.equal(assigned.nextLocation?.label, 20);
    assert.equal(before.status, 'ready');
    assert.ok(Object.isFrozen(assigned));
    assert.throws(() => second.basic.run('10 PRINT A'), api.BasicRuntimeError);
    first.basic.step();
    assert.deepEqual(first.output, ['7\n']);
    assert.equal(first.basic.step().status, 'halted');
    assert.equal(first.basic.run().status, 'halted');
    assert.deepEqual(first.output, ['7\n', '7\n']);
    first.basic.reset('10 PRINT A');
    assert.throws(
      () => first.basic.step(),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'UNDEFINED_VARIABLE');
        return true;
      },
    );
  });
  await check('source-located syntax and runtime failures', () => {
    const {basic, output} = setup();
    assert.throws(
      () => basic.run('1 PRINT "must not run"\n20 PRINT 1+'),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicSyntaxError);
        assert.equal(error.diagnostic.code, 'EXPECTED_EXPRESSION');
        assert.equal(error.diagnostic.label, 20);
        assert.equal(error.diagnostic.line, 2);
        assert.equal(error.diagnostic.column, 12);
        return true;
      },
    );
    assert.deepEqual(output, []);
    assert.throws(
      () => basic.run('30 PRINT "skipped"\r\n20 PRINT MISSING'),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'UNDEFINED_VARIABLE');
        assert.equal(error.diagnostic.label, 20);
        assert.equal(error.diagnostic.line, 2);
        assert.equal(error.diagnostic.column, 10);
        return true;
      },
    );
    assert.equal(basic.status, 'error');
    assert.equal(basic.state.nextLocation, null);
    assert.deepEqual(output, []);
    assert.equal(basic.run('10 END').status, 'halted');
  });
  await check('arithmetic and string failures preserve diagnostics and allow recovery', () => {
    const {basic, output} = setup();
    for (const {expression, code, column, message} of [
      {
        expression: '1/0',
        code: 'DIVISION_BY_ZERO',
        column: 11,
        message: 'Cannot divide by zero',
      },
      {
        expression: 'ABS("Ada")',
        code: 'TYPE_MISMATCH',
        column: 10,
        message: 'Expected a number',
      },
      {
        expression: '"Ada"+1',
        code: 'TYPE_MISMATCH',
        column: 15,
        message: 'Expected a number',
      },
    ]) {
      output.length = 0;
      assert.throws(
        () => basic.run(`10 PRINT "before"\n20 PRINT ${expression}\n30 PRINT "skipped"`),
        (error: unknown) => {
          assert.ok(error instanceof api.BasicRuntimeError);
          assert.equal(error.diagnostic.code, code);
          assert.equal(error.diagnostic.label, 20);
          assert.equal(error.diagnostic.line, 2);
          assert.equal(error.diagnostic.column, column);
          assert.equal(error.message, `Line 20, column ${column}: ${message}`);
          return true;
        },
      );
      assert.deepEqual(output, ['before\n']);
      assert.equal(basic.status, 'error');
      assert.equal(basic.run('10 PRINT "recovered"').status, 'halted');
      assert.deepEqual(output, ['before\n', 'recovered\n']);
    }
  });
  await check('numeric retry and input EOF', async () => {
    const {basic, output, prompts} = setup(['12oops', ' \t-2.5\t ', null]);
    assert.equal((await basic.runAsync('10 INPUT "Number"; N\n20 PRINT N*2')).status, 'halted');
    assert.deepEqual(output, ['Invalid number; please enter a finite decimal.\n', '-5\n']);
    assert.deepEqual(prompts, ['Number? ', 'Number? ']);
    await assert.rejects(basic.runAsync('20 INPUT N\n30 PRINT "skipped"'), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 20);
      assert.equal(error.diagnostic.column, 4);
      return true;
    });
    assert.equal(basic.status, 'error');
    assert.deepEqual(output, ['Invalid number; please enter a finite decimal.\n', '-5\n']);
  });
  await check('cancellation and late reply', async () => {
    const {basic, requests, output} = pending();
    const old = basic.runAsync('10 INPUT N\n20 PRINT "old";N');
    const rejected = assert.rejects(old, {name: 'AbortError'});
    assert.equal(basic.status, 'waiting');
    assert.equal(basic.cancel().status, 'halted');
    assert.equal(requests[0].signal?.aborted, true);
    await rejected;
    basic.run('10 LET N=9\n20 PRINT N');
    const current = basic.state;
    requests[0].reply('123');
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(basic.state, current);
    assert.deepEqual(output, ['9\n']);
  });
  await check('replacement run isolates old input', async () => {
    const {basic, requests, output} = pending();
    const old = basic.runAsync('10 INPUT N\n20 PRINT "old";N');
    const rejected = assert.rejects(old, {name: 'AbortError'});
    const fresh = basic.runAsync('30 INPUT N\n40 PRINT "new:";N');
    await rejected;
    requests[0].reply('100');
    await Promise.resolve();
    assert.equal(basic.status, 'waiting');
    assert.equal(basic.state.currentLocation?.label, 30);
    requests[1].reply('5');
    assert.equal((await fresh).status, 'halted');
    assert.deepEqual(output, ['new:5\n']);
  });
  await check('nested, descending, empty, and inactive loops', () => {
    const {basic, output} = setup();
    basic.reset(
      [
        '10 FOR I=2 TO 1 STEP -1',
        '20 FOR J=1 TO 2',
        '30 PRINT I;":";J',
        '40 NEXT J',
        '50 NEXT I',
        '60 FOR K=3 TO 1',
        '70 PRINT "skipped"',
        '80 NEXT K',
        '90 PRINT I;":";J;":";K',
      ].join('\n'),
    );
    let budget = 100;
    while (basic.status !== 'halted' && budget-- > 0) basic.step();
    assert.equal(basic.status, 'halted', 'Loop exceeded its bounded step budget');
    assert.deepEqual(output, ['2:1\n', '2:2\n', '1:1\n', '1:2\n', '0:3:3\n']);
    assert.throws(
      () => basic.run('10 GOTO 30\n20 FOR I=1 TO 2\n30 PRINT "bad"\n40 NEXT I'),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'LOOP_ENTRY');
        assert.equal(error.diagnostic.label, 10);
        assert.equal(error.diagnostic.column, 9);
        return true;
      },
    );
  });
  await check('instruction limits and cooperative batches', async () => {
    const {basic, output} = setup();
    let yields = 0;
    await assert.rejects(
      basic.runAsync('10 LET N=0\n20 LET N=N+1\n30 PRINT N\n40 GOTO 20', {
        instructionLimit: 7,
        yieldEvery: 2,
        scheduler: () => {
          yields++;
          return Promise.resolve();
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'INSTRUCTION_LIMIT');
        assert.equal(error.diagnostic.label, 20);
        assert.equal(error.diagnostic.column, 4);
        return true;
      },
    );
    assert.equal(yields, 3);
    assert.deepEqual(output, ['1\n', '2\n']);
    assert.equal(basic.status, 'error');
    assert.equal((await basic.runAsync('10 PRINT "recovered"')).status, 'halted');
    assert.deepEqual(output, ['1\n', '2\n', 'recovered\n']);
  });
  await check('replacement run isolates a pending scheduler', async () => {
    const {basic, output} = setup();
    let scheduled!: () => void;
    const ready = new Promise<void>((resolve) => {
      scheduled = resolve;
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let oldSignal: AbortSignal | undefined;
    const old = basic.runAsync('10 PRINT "old"\n20 GOTO 10', {
      yieldEvery: 1,
      scheduler(signal) {
        oldSignal = signal;
        scheduled();
        return pending;
      },
    });
    const rejected = assert.rejects(old, {name: 'AbortError'});
    await ready;
    basic.run('10 PRINT "new"');
    const current = basic.state;
    await rejected;
    assert.equal(oldSignal?.aborted, true);
    release();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(basic.state, current);
    assert.deepEqual(output, ['old\n', 'new\n']);
  });
  assert.deepEqual(completed, libraryAcceptanceCases);
  return completed;
}
