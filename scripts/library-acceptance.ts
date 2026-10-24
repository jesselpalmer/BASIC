import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type * as PublicApi from '../src/index.ts';
import type {Host} from '../src/index.ts';

type Api = Pick<typeof PublicApi, 'Basic' | 'BasicSyntaxError' | 'BasicRuntimeError'>;

export const libraryAcceptanceCases = [
  'greeting preserves input',
  'guessing game and fresh rerun',
  'times-table example',
  'stepping, reset, and instance isolation',
  'source-located syntax and runtime failures',
  'numeric retry and input EOF',
  'cancellation and late reply',
  'replacement run isolates old input',
  'nested, descending, empty, and inactive loops',
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
      '10 FOR I=2 TO 1 STEP -1\n20 FOR J=1 TO 2\n30 PRINT I;":";J\n40 NEXT J\n50 NEXT I\n60 FOR K=3 TO 1\n70 PRINT "skipped"\n80 NEXT K\n90 PRINT I;":";J;":";K',
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
  assert.deepEqual(completed, libraryAcceptanceCases);
  return completed;
}
