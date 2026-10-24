import {describe, expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {BrowserSession} from './index.ts';
import type {BrowserSessionOptions, BrowserState, BrowserView} from './session.ts';

function view() {
  const output: string[] = [];
  const states: BrowserState[] = [];
  const requests: {prompt: string; submit: (text: string) => boolean}[] = [];
  let clears = 0;
  const callbacks: BrowserView = {
    write: (text) => output.push(text),
    clear: () => {
      clears++;
      output.length = 0;
    },
    requestInput: (prompt, submit) => requests.push({prompt, submit}),
    stateChanged: (state) => states.push(state),
  };
  return {output, states, requests, callbacks, clears: () => clears};
}

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Expected browser session event did not occur');
}

const example = (name: string) =>
  readFile(new URL(`../../examples/${name}.bas`, import.meta.url), 'utf8');

async function rejection(promise: Promise<BrowserState>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected browser run to reject');
}

describe('browser session', () => {
  test('steps exactly one statement through labels, branches, loops and END', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const source =
      '90 END\n10 LET N = 0\n20 FOR I = 1 TO 2\n30 LET N = N + I\n40 NEXT I\n50 IF N = 3 THEN 70\n60 LET N = 99\n70 GOTO 90';
    const finished = session.run(source, {paused: true});
    expect(session.state).toMatchObject({
      status: 'paused',
      isPaused: true,
      currentLocation: null,
      nextLocation: {label: 10},
      variables: [],
    });
    const initial = session.state;
    const attempts = [10, 20, 30, 40, 30, 40, 50, 70];
    const next = [20, 30, 40, 30, 40, 50, 70, 90];
    for (let index = 0; index < attempts.length; index++) {
      expect(session.step().status).toBe('running');
      await until(() => session.state.status === 'paused');
      expect(session.state.currentLocation?.label).toBe(attempts[index]);
      expect(session.state.nextLocation?.label).toBe(next[index]);
    }
    expect(session.state.variables).toEqual([
      {name: 'N', value: 3},
      {name: 'I', value: 3},
    ]);
    expect(Object.isFrozen(session.state.variables)).toBe(true);
    expect(Object.isFrozen(session.state.variables[0])).toBe(true);
    expect(initial.variables).toEqual([]);
    expect(initial.nextLocation?.start.line).toBe(2);
    expect(session.state.source).toBe(source);
    session.step();
    expect((await finished).status).toBe('finished');
    expect(session.state.isPaused).toBe(false);
    expect(session.state.nextLocation).toBeNull();
    const terminal = session.state;
    expect(session.pause()).toBe(terminal);
    expect(session.resume()).toBe(terminal);
    expect(session.step()).toBe(terminal);
  });

  test('a stepped INPUT waits through retry and pauses before the following statement', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run('10 INPUT N\n20 PRINT N', {paused: true});
    session.step();
    await until(() => session.state.status === 'waiting');
    expect(session.state).toMatchObject({
      isPaused: true,
      currentLocation: {label: 10},
      nextLocation: null,
      variables: [],
    });
    expect(session.step().status).toBe('waiting');
    ui.requests[0].submit('invalid');
    await until(() => ui.requests.length === 2);
    expect(session.state.status).toBe('waiting');
    expect(session.state.variables).toEqual([]);
    ui.requests[1].submit('12');
    await until(() => session.state.status === 'paused');
    expect(session.state).toMatchObject({
      currentLocation: {label: 10},
      nextLocation: {label: 20},
      variables: [{name: 'N', value: 12}],
    });
    expect(ui.output).toEqual(['Invalid number; please enter a finite decimal.\n']);
    session.resume();
    expect((await finished).status).toBe('finished');
    expect(ui.output.at(-1)).toBe('12\n');
  });

  test('pause preserves an outstanding INPUT and can continue it or step its completion', async () => {
    for (const command of ['resume', 'step', 'submit'] as const) {
      const ui = view();
      const session = new BrowserSession(ui.callbacks);
      const finished = session.run('10 INPUT NAME$\n20 PRINT NAME$');
      const submit = ui.requests[0].submit;
      expect(session.pause()).toMatchObject({status: 'waiting', isPaused: true});
      expect(session.state.currentLocation?.label).toBe(10);
      if (command !== 'submit') session[command]();
      expect(submit(' Ada ')).toBe(true);
      if (command !== 'resume') {
        await until(
          () => session.state.status === 'paused' && session.state.variables.length === 1,
        );
        expect(ui.output).toEqual([]);
        expect(session.state.variables).toEqual([{name: 'NAME$', value: ' Ada '}]);
        session.resume();
      }
      expect((await finished).status).toBe('finished');
      expect(ui.output).toEqual([' Ada \n']);
      expect(submit('stale')).toBe(false);
    }
  });

  test('Continue releases a stepped INPUT without adding a second step', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run('10 INPUT N\n20 PRINT N', {paused: true});
    session.step();
    await until(() => session.state.status === 'waiting');
    expect(session.resume()).toMatchObject({status: 'waiting', isPaused: false});
    ui.requests[0].submit('4');
    expect((await finished).status).toBe('finished');
    expect(ui.output).toEqual(['4\n']);
  });

  test('Pause survives a scheduler await; Step and Continue preserve busy loop variables', async () => {
    const ui = view();
    const releases: (() => void)[] = [];
    const session = new BrowserSession(ui.callbacks, {
      yieldEvery: 1,
      scheduler: () => new Promise<void>((resolve) => releases.push(resolve)),
    });
    const finished = session.run('10 LET N = 0\n20 LET N = N + 1\n30 IF N < 2 THEN 20\n40 PRINT N');
    await until(() => releases.length === 1);
    const paused = session.pause();
    expect(paused.variables).toEqual([{name: 'N', value: 0}]);
    session.step();
    releases[0]();
    await until(() => releases.length === 2);
    expect(session.state.variables).toEqual([{name: 'N', value: 1}]);
    releases[1]();
    await until(() => session.state.status === 'paused');
    expect(session.state.nextLocation?.label).toBe(30);
    expect(paused.variables).toEqual([{name: 'N', value: 0}]);
    session.resume();
    for (let index = 2; index < 5; index++) {
      await until(() => releases.length > index);
      releases[index]();
    }
    expect((await finished).status).toBe('finished');
    expect(ui.output).toEqual(['2\n']);
  });

  test('latest pause wins before a released gate resumes; stopped gates cannot affect replacement', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const old = session.run('10 LET N = 1\n20 PRINT N', {paused: true});
    session.resume();
    session.pause();
    await until(() => session.state.status === 'paused');
    await Promise.resolve();
    expect(session.state.variables).toEqual([]);
    session.step();
    session.stop();
    const next = session.run('10 END', {paused: true});
    expect((await old).status).toBe('stopped');
    expect(session.state.variables).toEqual([]);
    expect(session.state.currentLocation).toBeNull();
    session.stop();
    expect((await next).status).toBe('stopped');
  });

  test('normal execution publishes snapshots at batch boundaries without per-statement view work', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks, {
      yieldEvery: 2,
      scheduler: () => Promise.resolve(),
    });
    await session.run('10 LET N = 1\n20 LET N = 2\n30 LET N = 3\n40 END');
    expect(ui.states.map(({status}) => status)).toEqual(['running', 'running', 'finished']);
    expect(ui.states[1]).toMatchObject({
      variables: [{name: 'N', value: 2}],
      nextLocation: {label: 30},
    });
  });

  test('idle debug commands are harmless and command view errors cancel their run', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    expect(session.pause()).toBe(session.state);
    expect(session.resume()).toBe(session.state);
    expect(session.step()).toBe(session.state);
    const finished = session.run('10 INPUT N');
    const error = new Error('cannot render pause');
    ui.callbacks.stateChanged = () => {
      throw error;
    };
    expect(() => session.pause()).toThrow(error);
    expect(await rejection(finished)).toBe(error);
    expect(session.state.status).toBe('error');
    expect(ui.requests[0].submit('late')).toBe(false);
  });

  test('browser entry bundles only shared core/parser and browser host capabilities', async () => {
    const result = await Bun.build({
      entrypoints: [new URL('./index.ts', import.meta.url).pathname],
      target: 'browser',
      metafile: true,
    });
    expect(result.success).toBe(true);
    const inputs = Object.keys(result.metafile!.inputs);
    expect(inputs.some((path) => path.endsWith('src/core/runtime.ts'))).toBe(true);
    expect(inputs.some((path) => path.endsWith('src/parser/parser.ts'))).toBe(true);
    for (const path of inputs) {
      expect(path).toMatch(/src\/(browser|core|parser|dictionaries)\//);
      const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/\b(?:process|Bun)\b|['"](?:node:|bun:)/);
    }
    const generated = await result.outputs[0].text();
    expect(generated).not.toMatch(/\b(?:process|Bun)\b|['"](?:node:|bun:)/);
    expect(generated).toContain('BrowserSession');
  });

  test('idle observation, immutable source snapshots, fresh variables and terminal stop', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    expect(session.state).toEqual({
      status: 'idle',
      isPaused: false,
      source: '',
      diagnostic: null,
      currentLocation: null,
      nextLocation: null,
      variables: [],
    });
    expect(session.stop()).toBe(session.state);
    expect(session.submitInput('unused')).toBe(false);
    let source = '10 LET N = 7\n20 PRINT N';
    const first = session.run(source);
    const snapshot = session.state;
    source = '10 PRINT N';
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect((await first).status).toBe('finished');
    expect(snapshot.source).toBe('10 LET N = 7\n20 PRINT N');
    expect(ui.output).toEqual(['7\n']);
    expect(session.stop().status).toBe('finished');
    expect((await session.run(source)).status).toBe('error');
    expect(ui.output).toEqual([]);
    expect(ui.clears()).toBe(2);
  });

  test('runs greeting through core INPUT and preserves untrimmed strings', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run(await example('greeting'));
    expect(session.state.status).toBe('waiting');
    expect(ui.requests[0].prompt).toBe('What is your name? ');
    expect(session.submitInput(' Ada ')).toBe(true);
    expect(session.submitInput('duplicate')).toBe(false);
    expect((await finished).status).toBe('finished');
    expect(ui.output).toEqual(['Hello,  Ada !\n']);
    expect(ui.states.map((state) => state.status)).toEqual([
      'running',
      'waiting',
      'running',
      'finished',
    ]);
  });

  test('uses core numeric retry and loop semantics for the times table', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run(await example('times-table'));
    expect(ui.requests[0].submit('not a number')).toBe(true);
    await until(() => ui.requests.length === 2);
    expect(ui.output).toEqual(['Invalid number; please enter a finite decimal.\n']);
    expect(ui.requests[0].submit('99')).toBe(false);
    expect(ui.requests[1].submit('3')).toBe(true);
    expect((await finished).status).toBe('finished');
    expect(ui.output.slice(1).join('')).toBe(
      '1 x 3 = 3\n2 x 3 = 6\n3 x 3 = 9\n4 x 3 = 12\n5 x 3 = 15\n' +
        '6 x 3 = 18\n7 x 3 = 21\n8 x 3 = 24\n9 x 3 = 27\n10 x 3 = 30\n',
    );
  });

  test('runs guessing branches with deterministic host randomness', async () => {
    const ui = view();
    const options = {random: () => 0.49};
    const session = new BrowserSession(ui.callbacks, options);
    options.random = () => 0;
    const finished = session.run(await example('guess'));
    await until(() => ui.requests.length === 1);
    ui.requests[0].submit('20');
    await until(() => ui.requests.length === 2);
    ui.requests[1].submit('80');
    await until(() => ui.requests.length === 3);
    ui.requests[2].submit('50');
    expect((await finished).status).toBe('finished');
    expect(ui.output).toEqual(['Too low.\n', 'Too high.\n', 'Correct in 3 tries!\n']);
  });

  test('CLS and default random use the shared host', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    await session.run('10 PRINT "old"\n20 CLS\n30 PRINT RND()');
    expect(ui.clears()).toBe(2);
    expect(ui.output).toHaveLength(1);
    expect(Number(ui.output[0])).toBeGreaterThanOrEqual(0);
    expect(Number(ui.output[0])).toBeLessThan(1);
  });

  test.each([
    ['\n10 PRINT "unterminated', 'UNTERMINATED_STRING', 2, 10],
    ['10 PRINT "unreachable"\n20 GOTO 999', 'MISSING_TARGET', 2, 20],
    ['10 PRINT "before"\n20 PRINT 1 / 0', 'DIVISION_BY_ZERO', 2, 20],
  ])('reports located diagnostics for %s', async (source, code, line, label) => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const result = await session.run(source);
    expect(result.status).toBe('error');
    expect(result.diagnostic).toMatchObject({code, line, label});
    expect(result.diagnostic!.column).toBeGreaterThan(0);
    expect(result.diagnostic!.offset).toBeGreaterThan(0);
    expect(Object.isFrozen(result.diagnostic)).toBe(true);
    if (code !== 'DIVISION_BY_ZERO') expect(ui.output).toEqual([]);
    expect(session.stop()).toBe(result);
    expect((await session.run('10 PRINT "recovered"')).status).toBe('finished');
    expect(ui.output).toEqual(['recovered\n']);
  });

  test('stop releases pending input; replacement rejects stale and duplicate callbacks', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const oldSource = '10 INPUT N\n20 PRINT N';
    const oldRun = session.run(oldSource);
    const oldSubmit = ui.requests[0].submit;
    expect(session.stop().status).toBe('stopped');
    expect(session.submitInput('old')).toBe(false);
    expect(oldSubmit('5')).toBe(false);
    const nextRun = session.run('10 INPUT NAME$\n20 PRINT NAME$');
    expect(oldSubmit('6')).toBe(false);
    expect(ui.requests[1].submit('new')).toBe(true);
    expect((await oldRun).status).toBe('stopped');
    expect((await nextRun).status).toBe('finished');
    expect(ui.output).toEqual(['new\n']);
    expect(ui.states.filter((state) => state.source === oldSource).at(-1)!.status).toBe('stopped');
  });

  test('run itself cancels an input request before replacing its owner', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const old = session.run('10 INPUT N');
    const next = session.run('10 PRINT "replacement"');
    expect(ui.requests[0].submit('9')).toBe(false);
    expect((await old).status).toBe('stopped');
    expect((await next).status).toBe('finished');
    expect(ui.output).toEqual(['replacement\n']);
  });

  test('a cancelled scheduler can resolve late without touching a replacement', async () => {
    const ui = view();
    let resume!: () => void;
    let yielded = false;
    const session = new BrowserSession(ui.callbacks, {
      yieldEvery: 1,
      scheduler: () =>
        new Promise<void>((resolve) => {
          yielded = true;
          resume = resolve;
        }),
    });
    const old = session.run('10 PRINT "old"\n20 GOTO 10');
    await until(() => yielded);
    const next = session.run('10 PRINT "new"');
    expect((await old).status).toBe('stopped');
    expect((await next).status).toBe('finished');
    resume();
    await Promise.resolve();
    expect(session.state.status).toBe('finished');
    expect(ui.output).toEqual(['new\n']);
  });

  test('default timer tasks allow stopping a busy loop and rerunning', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const old = session.run('10 GOTO 10');
    const stopped = new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(session.stop().status).toBe('stopped');
        resolve();
      }, 0),
    );
    await stopped;
    expect((await old).status).toBe('stopped');
    expect((await session.run('10 END')).status).toBe('finished');
  });

  test('stop wins even after a single-statement core run has completed', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run('10 END');
    await Promise.resolve();
    session.stop();
    expect((await finished).status).toBe('stopped');
    expect(session.state.status).toBe('stopped');
  });

  test('scheduler failures retain core source diagnostics; invalid options reject', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks, {
      yieldEvery: 1,
      scheduler: () => Promise.reject(new Error('scheduler failed')),
    });
    expect((await session.run('10 REM first\n20 END')).diagnostic).toMatchObject({
      code: 'SCHEDULER_FAILED',
      line: 2,
      label: 20,
    });
    const invalid = new BrowserSession(ui.callbacks, {yieldEvery: 0});
    expect(await rejection(invalid.run('10 END'))).toMatchObject({
      message: 'yieldEvery must be a positive safe integer',
    });
    expect(invalid.state.status).toBe('error');
    const invalidScheduler = new BrowserSession(ui.callbacks, {
      scheduler: null,
    } as unknown as BrowserSessionOptions);
    expect(await rejection(invalidScheduler.run('10 END'))).toMatchObject({
      message: 'scheduler must be a function',
    });
    expect(invalidScheduler.state.status).toBe('error');
  });

  test('invalid JavaScript caller input rejects without inventing a BASIC diagnostic', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    expect(await rejection(session.run(null as unknown as string))).toBeInstanceOf(TypeError);
    expect(session.state).toMatchObject({status: 'error', diagnostic: null});
    expect((await session.run('10 END')).status).toBe('finished');
  });

  test.each(['write', 'clear', 'requestInput', 'stateChanged'] as const)(
    'propagates %s callback errors and permits later recovery',
    async (name) => {
      const ui = view();
      const failure = new Error(`broken ${name}`);
      const original = ui.callbacks[name].bind(ui.callbacks);
      ui.callbacks[name] = () => {
        throw failure;
      };
      const session = new BrowserSession(ui.callbacks);
      expect(await rejection(session.run('10 PRINT "first"\n20 INPUT N'))).toBe(failure);
      expect(session.state.status).toBe('error');
      expect(session.submitInput('stale')).toBe(false);
      Object.assign(ui.callbacks, {[name]: original});
      expect((await session.run('10 PRINT "recovered"')).status).toBe('finished');
    },
  );

  test('a state callback failure during submit rejects the run and the submitter', async () => {
    const ui = view();
    const session = new BrowserSession(ui.callbacks);
    const finished = session.run('10 INPUT N');
    const failure = new Error('cannot render submitted state');
    ui.callbacks.stateChanged = () => {
      throw failure;
    };
    expect(() => session.submitInput('1')).toThrow(failure);
    expect(await rejection(finished)).toBe(failure);
    expect(session.state.status).toBe('error');
  });

  test('input can be submitted synchronously from the prompt callback', async () => {
    const ui = view();
    ui.callbacks.requestInput = (_prompt, submit) => {
      submit('42');
    };
    const session = new BrowserSession(ui.callbacks);
    expect((await session.run('10 INPUT N\n20 PRINT N')).status).toBe('finished');
    expect(ui.output).toEqual(['42\n']);
  });

  test.each(['write', 'clear', 'requestInput', 'stateChanged'] as const)(
    '%s callbacks cannot replace or stop execution in the middle of a host effect',
    async (name) => {
      const ui = view();
      const failures: Promise<unknown>[] = [];
      const session = new BrowserSession(ui.callbacks);
      ui.callbacks[name] = () => {
        expect(() => session.stop()).toThrow('browser view callback');
        expect(() => session.pause()).toThrow('browser view callback');
        expect(() => session.step()).toThrow('browser view callback');
        expect(() => session.resume()).toThrow('browser view callback');
        failures.push(
          session.run('10 PRINT "leaked"').then(
            () => {
              throw new Error('Reentrant run unexpectedly succeeded');
            },
            (error: unknown) => {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message).toContain('browser view callback');
            },
          ),
        );
      };
      const finished = session.run('10 INPUT N\n20 PRINT N');
      if (name === 'requestInput') session.submitInput('2');
      else if (session.state.status === 'waiting') session.submitInput('2');
      expect((await finished).status).toBe('finished');
      await Promise.all(failures);
      expect(ui.output.join('')).not.toContain('leaked');
    },
  );
});
