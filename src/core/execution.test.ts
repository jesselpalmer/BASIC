import {describe, expect, it, jest} from 'bun:test';
import {getEventListeners} from 'node:events';
import {Basic, BasicRuntimeError} from '../index.ts';
import type {ExecutionScheduler, RunOptions, RunResult} from '../index.ts';
import {defaultScheduler, yieldExecution} from './scheduling.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}

function pausedScheduler() {
  const entered = deferred<AbortSignal>();
  const work = deferred<void>();
  const scheduler: ExecutionScheduler = (signal) => {
    entered.resolve(signal);
    return work.promise;
  };
  return {scheduler, entered, work};
}

const failure = (work: Promise<unknown>) => work.catch((error: unknown) => error);

function setup() {
  const output: string[] = [];
  const basic = new Basic({write: (text) => output.push(text)});
  return {basic, output};
}

describe('cooperative execution', () => {
  it('yields after each configured batch without yielding after END or the last statement', async () => {
    const {basic, output} = setup();
    const atYields: number[] = [];
    const scheduler: ExecutionScheduler = () => {
      atYields.push(output.length);
      return Promise.resolve();
    };
    await basic.runAsync('10 PRINT 1\n20 PRINT 2\n30 PRINT 3\n40 PRINT 4\n50 END', {
      yieldEvery: 2,
      scheduler,
    });
    expect(atYields).toEqual([2, 4]);
    atYields.length = 0;
    await basic.runAsync('10 PRINT 1\n20 PRINT 2', {yieldEvery: 2, scheduler});
    expect(atYields).toEqual([]);
    await basic.runAsync('10 END\n20 PRINT "unreachable"', {yieldEvery: 1, scheduler});
    expect(atYields).toEqual([]);
    expect(output).toEqual(['1\n', '2\n', '3\n', '4\n', '1\n', '2\n']);
  });

  it('uses a task boundary so a busy loop can be stopped by an ordinary timer', async () => {
    const {basic} = setup();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 0);
    try {
      const error = await failure(basic.runAsync('10 GOTO 10', {signal: controller.signal}));
      expect(error).toMatchObject({name: 'AbortError'});
      expect(basic.state).toMatchObject({status: 'halted', diagnostic: null});
      expect(basic.run('10 END').status).toBe('halted');
    } finally {
      clearTimeout(timer);
    }
  });

  it('cancels a scheduler that never settles and ignores its late completion', async () => {
    const {basic, output} = setup();
    const paused = pausedScheduler();
    const old = failure(
      basic.runAsync('10 PRINT "old"\n20 GOTO 10', {yieldEvery: 1, scheduler: paused.scheduler}),
    );
    const signal = await paused.entered.promise;
    expect(basic.status).toBe('running');
    expect(basic.cancel().status).toBe('halted');
    expect(signal.aborted).toBe(true);
    expect(await old).toMatchObject({name: 'AbortError'});
    basic.run('10 PRINT "fresh"');
    const current = basic.state;
    paused.work.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(basic.state).toEqual(current);
    expect(output).toEqual(['old\n', 'fresh\n']);
  });

  it('aborts suspended scheduling, removes signal listeners, and leaves the program rerunnable', async () => {
    const {basic, output} = setup();
    const controller = new AbortController();
    const paused = pausedScheduler();
    const old = failure(
      basic.runAsync('10 PRINT "once"\n20 END', {
        signal: controller.signal,
        yieldEvery: 1,
        scheduler: paused.scheduler,
      }),
    );
    const signal = await paused.entered.promise;
    controller.abort();
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(signal.aborted).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
    expect(getEventListeners(signal, 'abort')).toEqual([]);
    expect(basic.run().status).toBe('halted');
    expect(output).toEqual(['once\n', 'once\n']);
    paused.work.reject(new Error('late scheduler rejection'));
    await Promise.resolve();
  });

  it('replacement execution is unaffected by an old scheduler rejection or old external abort', async () => {
    const {basic, output} = setup();
    const oldController = new AbortController();
    const paused = pausedScheduler();
    const old = failure(
      basic.runAsync('10 GOTO 10', {
        signal: oldController.signal,
        yieldEvery: 1,
        scheduler: paused.scheduler,
      }),
    );
    const oldSignal = await paused.entered.promise;
    const replacement = pausedScheduler();
    const fresh = basic.runAsync('20 PRINT "fresh"\n30 END', {
      yieldEvery: 1,
      scheduler: replacement.scheduler,
    });
    await replacement.entered.promise;
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(oldSignal.aborted).toBe(true);
    expect(getEventListeners(oldController.signal, 'abort')).toEqual([]);
    const current = basic.state;
    paused.work.reject(new Error('old failed'));
    oldController.abort();
    await Promise.resolve();
    await Promise.resolve();
    expect(basic.state).toEqual(current);
    replacement.work.resolve();
    expect((await fresh).status).toBe('halted');
    expect(output).toEqual(['fresh\n']);
  });

  it('reset while scheduling clears prior execution and cannot be undone by old completion', async () => {
    const {basic, output} = setup();
    const paused = pausedScheduler();
    const old = failure(basic.runAsync('10 GOTO 10', {yieldEvery: 1, scheduler: paused.scheduler}));
    await paused.entered.promise;
    basic.reset('20 PRINT "reset"');
    expect(await old).toMatchObject({name: 'AbortError'});
    const current = basic.state;
    paused.work.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(basic.state).toEqual(current);
    basic.run();
    expect(output).toEqual(['reset\n']);
  });

  it('does not let a scheduler restart mutate its replacement through stale continuation', async () => {
    const {basic, output} = setup();
    const error = await failure(
      basic.runAsync('10 GOTO 10', {
        yieldEvery: 1,
        scheduler() {
          basic.run('20 PRINT "replacement"');
          return Promise.resolve();
        },
      }),
    );
    expect(error).toMatchObject({name: 'AbortError'});
    expect(basic.state).toMatchObject({status: 'halted', currentLocation: {label: 20}});
    expect(output).toEqual(['replacement\n']);
  });

  it.each(['throw', 'reject'] as const)(
    'preserves replacement INPUT when its old scheduler then fails with %s',
    async (mode) => {
      const reply = deferred<string | null>();
      const output: string[] = [];
      let inputSignal: AbortSignal | undefined;
      const basic = new Basic({
        write: (text) => output.push(text),
        readLine(_prompt, options) {
          inputSignal = options?.signal;
          return reply.promise;
        },
      });
      let fresh!: Promise<RunResult>;
      const cause = new Error('old scheduler failed after restart');
      const old = failure(
        basic.runAsync('10 GOTO 10', {
          yieldEvery: 1,
          scheduler() {
            fresh = basic.runAsync('20 INPUT N\n30 PRINT "fresh:";N');
            if (mode === 'throw') throw cause;
            return Promise.reject(cause);
          },
        }),
      );
      expect(await old).toMatchObject({name: 'AbortError'});
      expect(basic.state).toMatchObject({status: 'waiting', currentLocation: {label: 20}});
      expect(inputSignal?.aborted).toBe(false);
      reply.resolve('7');
      expect((await fresh).status).toBe('halted');
      expect(output).toEqual(['fresh:7\n']);
    },
  );

  it.each(['throw', 'reject'] as const)(
    'reports a source-located scheduler %s and permits recovery',
    async (mode) => {
      const {basic, output} = setup();
      const cause = new Error('scheduler unavailable');
      const scheduler: ExecutionScheduler = () => {
        if (mode === 'throw') throw cause;
        return Promise.reject(cause);
      };
      const error = await failure(
        basic.runAsync('10 PRINT "first"\n20 PRINT "next"', {yieldEvery: 1, scheduler}),
      );
      expect(error).toBeInstanceOf(BasicRuntimeError);
      expect(error).toMatchObject({
        diagnostic: {code: 'SCHEDULER_FAILED', label: 20, line: 2, column: 4},
        cause,
      });
      expect(basic.state).toMatchObject({status: 'error', currentLocation: {label: 20}});
      expect(output).toEqual(['first\n']);
      expect(basic.run('10 END').status).toBe('halted');
    },
  );

  it('normalizes a non-Error scheduler failure at the host boundary', async () => {
    const {basic} = setup();
    const error = await failure(
      basic.runAsync('10 GOTO 10', {
        yieldEvery: 1,
        scheduler() {
          // Simulate an untyped host callback violating its Error contract.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw 'untyped scheduler failure';
        },
      }),
    );
    expect(error).toMatchObject({
      diagnostic: {code: 'SCHEDULER_FAILED'},
      cause: {message: 'Execution scheduler failed', cause: 'untyped scheduler failure'},
    });
  });

  it('removes external abort listeners after success and runtime failure', async () => {
    const {basic} = setup();
    const controller = new AbortController();
    await basic.runAsync('10 END', {signal: controller.signal});
    expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
    await failure(basic.runAsync('10 PRINT 1/0', {signal: controller.signal}));
    expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
  });

  it.each(['10 PRINT "last"', '10 PRINT "last"\n20 END'])(
    'honors an abort raised during the last permitted statement: %j',
    async (source) => {
      const controller = new AbortController();
      const basic = new Basic({write: () => controller.abort()});
      const error = await failure(
        basic.runAsync(source, {signal: controller.signal, instructionLimit: 1}),
      );
      expect(error).toMatchObject({name: 'AbortError'});
      expect(basic.state).toMatchObject({status: 'halted', diagnostic: null});
    },
  );

  it('honors abort from the caller before the final run continuation', async () => {
    const controller = new AbortController();
    const {basic, output} = setup();
    const running = basic.runAsync('10 PRINT "completed statement"', {signal: controller.signal});
    controller.abort();
    expect(await failure(running)).toMatchObject({name: 'AbortError'});
    expect(basic.state).toMatchObject({status: 'halted', diagnostic: null});
    expect(output).toEqual(['completed statement\n']);
  });

  it.each(['10 PRINT "never"', ''])(
    'rejects an already aborted run before observable effects: %j',
    async (source) => {
      const {basic, output} = setup();
      const controller = new AbortController();
      controller.abort();
      const error = await failure(basic.runAsync(source, {signal: controller.signal}));
      expect(error).toMatchObject({name: 'AbortError'});
      expect(output).toEqual([]);
      expect(basic.status).toBe('halted');
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
    },
  );
});

describe('instruction budgets', () => {
  it('stops before the next instruction with its physical location and preserves source for rerun', async () => {
    const {basic, output} = setup();
    const source = '30 PRINT "unreachable"\n10 LET N=1\n20 GOTO 20';
    const error = await failure(basic.runAsync(source, {instructionLimit: 3}));
    expect(error).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20, line: 3, column: 4},
    });
    expect(basic.state).toMatchObject({
      status: 'error',
      currentLocation: {label: 20},
      nextLocation: null,
    });
    const again = await failure(basic.runAsync(undefined, {instructionLimit: 1}));
    expect(again).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20}});
    expect(output).toEqual([]);
    expect((await basic.runAsync('10 PRINT "healthy"', {instructionLimit: 1})).status).toBe(
      'halted',
    );
    expect(output).toEqual(['healthy\n']);
  });

  it('allows a zero budget for an empty program but prevents the first real statement', async () => {
    const {basic, output} = setup();
    expect((await basic.runAsync('', {instructionLimit: 0})).status).toBe('halted');
    const error = await failure(basic.runAsync('10 PRINT "never"', {instructionLimit: 0}));
    expect(error).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 10}});
    expect(output).toEqual([]);
  });

  it('reports an exhausted budget without waiting for an unnecessary scheduler call', async () => {
    const scheduler = jest.fn(() => new Promise<void>(() => {}));
    const error = await failure(
      new Basic().runAsync('10 GOTO 10', {instructionLimit: 1, yieldEvery: 1, scheduler}),
    );
    expect(error).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 10}});
    expect(scheduler).not.toHaveBeenCalled();
  });

  it('counts statements including REM/END while excluding yields and numeric INPUT retries', async () => {
    const output: string[] = [];
    const answers = ['bad', 'also bad', '7'];
    const scheduler = jest.fn(() => Promise.resolve());
    const basic = new Basic({
      write: (text) => output.push(text),
      readLine: () => Promise.resolve(answers.shift() ?? null),
    });
    const source = '10 INPUT N\n20 REM inert\n30 PRINT N\n40 END';
    expect(
      (await basic.runAsync(source, {instructionLimit: 4, yieldEvery: 1, scheduler})).status,
    ).toBe('halted');
    expect(scheduler).toHaveBeenCalledTimes(3);
    expect(output).toEqual([
      'Invalid number; please enter a finite decimal.\n',
      'Invalid number; please enter a finite decimal.\n',
      '7\n',
    ]);
    const error = await failure(basic.runAsync('10 REM one\n20 END', {instructionLimit: 1}));
    expect(error).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20}});
  });

  it('resets the counter after error, cancellation, and fresh invocation', async () => {
    const {basic, output} = setup();
    await failure(basic.runAsync('10 GOTO 10', {instructionLimit: 2}));
    const paused = pausedScheduler();
    const old = failure(
      basic.runAsync('10 GOTO 10', {
        instructionLimit: 2,
        yieldEvery: 1,
        scheduler: paused.scheduler,
      }),
    );
    await paused.entered.promise;
    basic.cancel();
    await old;
    for (let run = 0; run < 2; run++) {
      expect((await basic.runAsync('10 PRINT "fresh"\n20 END', {instructionLimit: 2})).status).toBe(
        'halted',
      );
    }
    expect(output).toEqual(['fresh\n', 'fresh\n']);
    paused.work.resolve();
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid instructionLimit %s without changing the loaded run',
    async (instructionLimit) => {
      const {basic} = setup();
      basic.reset('10 END');
      const before = basic.state;
      const error = await failure(basic.runAsync('20 PRINT "never"', {instructionLimit}));
      expect(error).toBeInstanceOf(TypeError);
      expect(basic.state).toEqual(before);
      expect(basic.run().currentLocation?.label).toBe(10);
    },
  );

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid yieldEvery %s',
    async (yieldEvery) => {
      const error = await failure(new Basic().runAsync('10 END', {yieldEvery}));
      expect(error).toBeInstanceOf(TypeError);
    },
  );

  it('rejects a non-callable scheduler from an untyped caller', async () => {
    const options = {scheduler: null} as unknown as RunOptions;
    expect(await failure(new Basic().runAsync('10 END', options))).toBeInstanceOf(TypeError);
  });
});

describe('scheduler resource ownership', () => {
  it('releases default scheduler abort listeners on completion and cancellation', async () => {
    const completed = new AbortController();
    await defaultScheduler(completed.signal);
    expect(getEventListeners(completed.signal, 'abort')).toEqual([]);
    for (const alreadyAborted of [false, true]) {
      const controller = new AbortController();
      if (alreadyAborted) controller.abort();
      const waiting = failure(defaultScheduler(controller.signal));
      controller.abort();
      expect(await waiting).toMatchObject({name: 'AbortError'});
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
    }
  });

  it('does not invoke a custom scheduler after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const scheduler = jest.fn(() => Promise.resolve());
    expect(await failure(yieldExecution(scheduler, controller.signal))).toMatchObject({
      name: 'AbortError',
    });
    expect(scheduler).not.toHaveBeenCalled();
  });
});
