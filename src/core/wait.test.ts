import {describe, expect, it, spyOn} from 'bun:test';
import {getEventListeners} from 'node:events';
import {
  Basic,
  BasicRuntimeError,
  BasicSyntaxError,
  createHost,
  parseLine,
  parseProgram,
  validateProgram,
} from '../index.ts';
import {defaultWait} from './scheduling.ts';
import {tokenize} from '../parser/tokenizer.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}
const failure = (work: Promise<unknown>) => work.catch((error: unknown) => error);
function controlled() {
  const entered = deferred<AbortSignal>();
  const work = deferred<void>();
  const durations: number[] = [];
  const output: string[] = [];
  const basic = new Basic({
    write: (text) => output.push(text),
    wait: (milliseconds, options) => {
      durations.push(milliseconds);
      entered.resolve(options!.signal!);
      return work.promise;
    },
  });
  return {basic, entered, work, durations, output};
}

describe('WAIT language', () => {
  it('parses a case-insensitive expression with physical locations and reserves only the full word', () => {
    expect(
      tokenize('10 wait WAITING')
        .filter((token) => ['KEYWORD', 'IDENTIFIER'].includes(token.type))
        .map((token) => [token.type, token.value]),
    ).toEqual([
      ['KEYWORD', 'WAIT'],
      ['IDENTIFIER', 'WAITING'],
    ]);
    const statement = parseProgram('30 END\r\n10 wait (1+2)*3').lines[0].statement;
    expect(statement.type).toBe('WaitStatement');
    expect(statement.location).toEqual({
      label: 10,
      start: {line: 2, column: 4, offset: 11},
      end: {line: 2, column: 16, offset: 23},
    });
    expect(Object.isFrozen(statement)).toBe(true);
    for (const source of ['WAIT', 'WAIT 1,2', 'WAIT 1;2', 'WAIT 1 2', 'LET WAIT=1'])
      expect(() => parseLine(`10 ${source}`)).toThrow(BasicSyntaxError);
  });

  it('preflights strings even on unreachable lines before any host effect and snapshots the expression', async () => {
    const calls: number[] = [];
    const output: string[] = [];
    const basic = new Basic({
      write: (text) => output.push(text),
      wait: (ms) => {
        calls.push(ms);
        return Promise.resolve();
      },
    });
    for (const expression of ['"ten"', 'S$', '("a"+"b")']) {
      expect(
        await failure(basic.runAsync(`1 PRINT "bad"\n2 END\n10 WAIT ${expression}`)),
      ).toMatchObject({diagnostic: {code: 'TYPE_MISMATCH', label: 10, line: 3, column: 9}});
    }
    expect(calls).toEqual([]);
    expect(output).toEqual([]);
    const candidate = structuredClone(parseProgram('10 WAIT 2').lines);
    const snapshot = validateProgram(candidate);
    const statement = candidate[0].statement;
    if (statement.type !== 'WaitStatement') throw new Error('Expected WAIT');
    Object.assign(statement.duration, {value: 9});
    await basic.runAsync(snapshot);
    expect(calls).toEqual([2]);
    expect(Object.isFrozen(statement)).toBe(false);
  });
});

describe('WAIT execution', () => {
  it('evaluates exactly once and rounds positive fractional milliseconds upward while retaining zero', async () => {
    const calls: number[] = [];
    let randomCalls = 0;
    const basic = new Basic({
      random() {
        randomCalls++;
        return 0.25;
      },
      wait(ms) {
        calls.push(ms);
        return Promise.resolve();
      },
    });
    await basic.runAsync(
      '10 WAIT RND()*10\n20 WAIT 0\n30 WAIT -.0\n40 WAIT .01\n50 WAIT 2147483647\n60 WAIT 2147483646.1',
    );
    expect(calls).toEqual([3, 0, 0, 1, 2147483647, 2147483647]);
    expect(Object.is(calls[2], -0)).toBe(false);
    expect(randomCalls).toBe(1);
  });

  it.each(['-1', '-.01', '2147483647.1', '2147483648', '9007199254740991'])(
    'rejects duration %s at its physical expression without calling the timer',
    async (expression) => {
      const calls: number[] = [];
      const basic = new Basic({
        wait(ms) {
          calls.push(ms);
          return Promise.resolve();
        },
      });
      expect(await failure(basic.runAsync(`30 END\r\n10 WAIT ${expression}`))).toMatchObject({
        diagnostic: {code: 'INVALID_WAIT_DURATION', label: 10, line: 2, column: 9, offset: 16},
      });
      expect(basic.state.status).toBe('error');
      expect(calls).toEqual([]);
    },
  );

  it('preserves expression failures and checks immediate string values at execution', async () => {
    for (const [expression, code] of [
      ['MISSING', 'UNDEFINED_VARIABLE'],
      ['1/0', 'DIVISION_BY_ZERO'],
      [`${'9'.repeat(308)}*2`, 'NON_FINITE_NUMBER'],
    ]) {
      expect(await failure(new Basic().runAsync(`10 WAIT ${expression}`))).toMatchObject({
        diagnostic: {code, label: 10},
      });
    }
    const basic = new Basic();
    expect(
      await failure(basic.readLineAsync('10 WAIT "bad"', {line: 8, offset: 100})),
    ).toMatchObject({
      diagnostic: {code: 'TYPE_MISMATCH', line: 8, label: 10, column: 9, offset: 108},
    });
  });

  it('requires asynchronous execution in run, step and immediate entries', () => {
    for (const mode of ['run', 'step', 'readLine']) {
      const basic = new Basic();
      const action = () => {
        if (mode === 'run') basic.run('10 WAIT 0');
        else if (mode === 'readLine') basic.readLine('10 WAIT 0');
        else {
          basic.reset('10 WAIT 0');
          basic.step();
        }
      };
      expect(action).toThrow(BasicRuntimeError);
      expect(basic.state).toMatchObject({
        status: 'error',
        currentLocation: {label: 10},
        diagnostic: {code: 'ASYNC_WAIT_REQUIRED', column: 4},
      });
    }
  });

  it('suspends one step, rejects overlapping calls, then exposes the successor without executing it', async () => {
    const {basic, entered, work, output} = controlled();
    basic.reset('10 WAIT 7\n20 PRINT "next"');
    const step = basic.stepAsync();
    const signal = await entered.promise;
    expect(basic.state).toMatchObject({
      status: 'waiting',
      currentLocation: {label: 10},
      nextLocation: null,
    });
    expect(() => basic.step()).toThrow('WAIT is already pending');
    expect(await failure(basic.stepAsync())).toEqual(
      new Error('WAIT is already pending; cancel or reset first'),
    );
    expect(() => basic.readLine('30 END')).toThrow('WAIT is already pending');
    work.resolve();
    expect(await step).toMatchObject({
      status: 'running',
      currentLocation: {label: 10},
      nextLocation: {label: 20},
    });
    expect(getEventListeners(signal, 'abort')).toEqual([]);
    expect(output).toEqual([]);
    expect(basic.step().status).toBe('halted');
    expect(output).toEqual(['next\n']);
  });

  it('supports immediate WAIT, a last WAIT statement, and independent instances', async () => {
    const first = controlled();
    const second = controlled();
    const immediate = first.basic.readLineAsync('10 WAIT 2');
    const last = second.basic.runAsync('20 WAIT 3');
    await Promise.all([first.entered.promise, second.entered.promise]);
    first.work.resolve();
    expect((await immediate).status).toBe('running');
    expect(second.basic.status).toBe('waiting');
    first.basic.readLine('20 PRINT "done"');
    expect(first.output).toEqual(['done\n']);
    second.work.resolve();
    expect((await last).status).toBe('halted');
    expect(second.durations).toEqual([3]);
  });

  it.each(['cancel', 'reset', 'replacement'] as const)(
    'invalidates %s work even if its host ignores cancellation and rejects late',
    async (action) => {
      const {basic, entered, work, output} = controlled();
      const controller = new AbortController();
      const old = failure(basic.runAsync('10 WAIT 7\n20 PRINT "old"', {signal: controller.signal}));
      const signal = await entered.promise;
      if (action === 'cancel') basic.cancel();
      else if (action === 'reset') basic.reset('30 PRINT "fresh"');
      else basic.run('30 PRINT "fresh"');
      expect(await old).toMatchObject({name: 'AbortError'});
      expect(signal.aborted).toBe(true);
      expect(getEventListeners(signal, 'abort')).toEqual([]);
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
      const state = basic.state;
      work.reject(new Error('late rejected timer'));
      controller.abort();
      await Promise.resolve();
      await Promise.resolve();
      expect(basic.state).toEqual(state);
      if (action !== 'replacement') basic.run('30 PRINT "fresh"');
      expect(output).toEqual(['fresh\n']);
    },
  );

  it('external abort releases direct step and immediate waits and preserves replacement INPUT', async () => {
    for (const mode of ['step', 'immediate']) {
      const {basic, entered, work} = controlled();
      const controller = new AbortController();
      basic.reset('10 WAIT 1');
      const pending = failure(
        mode === 'step'
          ? basic.stepAsync({signal: controller.signal})
          : basic.readLineAsync('10 WAIT 1', {signal: controller.signal}),
      );
      const signal = await entered.promise;
      controller.abort();
      expect(await pending).toMatchObject({name: 'AbortError'});
      expect(basic.status).toBe('halted');
      expect(signal.aborted).toBe(true);
      work.resolve();
    }
    const timer = deferred<void>();
    const answer = deferred<string | null>();
    const output: string[] = [];
    const basic = new Basic({
      wait: () => timer.promise,
      readLine: () => answer.promise,
      write: (text) => output.push(text),
    });
    const old = failure(basic.runAsync('10 WAIT 0\n20 PRINT "old"'));
    const fresh = basic.runAsync('30 INPUT N\n40 PRINT N');
    expect(await old).toMatchObject({name: 'AbortError'});
    timer.resolve();
    await Promise.resolve();
    expect(basic.state).toMatchObject({status: 'waiting', currentLocation: {label: 30}});
    answer.resolve('9');
    await fresh;
    expect(output).toEqual(['9\n']);
  });

  it('counts each WAIT once, honors before-statement gates, and retains INPUT and loop state', async () => {
    const events: string[] = [];
    const answers = ['bad', '4'];
    const gates: number[] = [];
    const basic = new Basic({
      wait: (ms) => {
        events.push(`wait:${ms}`);
        return Promise.resolve();
      },
      readLine: () => Promise.resolve(answers.shift() ?? null),
      write: (text) => events.push(text),
    });
    const source = '10 INPUT N\n20 FOR I=1 TO 2\n30 WAIT N\n40 PRINT I\n50 NEXT I\n60 END';
    await basic.runAsync(source, {
      instructionLimit: 9,
      beforeStatement: () => {
        gates.push(basic.state.nextLocation!.label!);
      },
    });
    expect(gates).toEqual([10, 20, 30, 40, 50, 30, 40, 50, 60]);
    expect(events).toEqual([
      'Invalid number; please enter a finite decimal.\n',
      'wait:4',
      '1\n',
      'wait:4',
      '2\n',
    ]);
    events.length = 0;
    expect(
      await failure(basic.runAsync('10 WAIT 1\n20 WAIT 2', {instructionLimit: 1})),
    ).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20}});
    expect(events).toEqual(['wait:1']);
    events.length = 0;
    expect(await failure(basic.runAsync('10 WAIT 1', {instructionLimit: 0}))).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT', label: 10},
    });
    expect(events).toEqual([]);
  });

  it('starts a fresh automatic batch after WAIT without resetting the total instruction budget', async () => {
    const events: string[] = [];
    const basic = new Basic({
      clear: () => events.push('clear'),
      draw: () => events.push('draw'),
      wait: () => {
        events.push('wait');
        return Promise.resolve();
      },
    });
    const scheduler = () => {
      events.push('batch');
      return Promise.resolve();
    };
    const source = '10 CLS\n20 PSET 1,2\n30 WAIT 0\n40 CLS\n50 PSET 3,4\n60 WAIT 0\n70 END';
    expect(
      (await basic.runAsync(source, {yieldEvery: 4, instructionLimit: 7, scheduler})).status,
    ).toBe('halted');
    expect(events).toEqual(['clear', 'draw', 'wait', 'clear', 'draw', 'wait']);
    expect(
      await failure(basic.runAsync(source, {yieldEvery: 4, instructionLimit: 6, scheduler})),
    ).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 70}});
    events.length = 0;
    await basic.runAsync('10 WAIT 0\n20 REM\n30 REM\n40 REM\n50 REM\n60 END', {
      yieldEvery: 4,
      scheduler,
    });
    expect(events).toEqual(['wait', 'batch']);
  });

  it('honors host AbortError and external abort raised synchronously while a wait is being requested', async () => {
    const abort = new Error('provider cancelled');
    abort.name = 'AbortError';
    const basic = new Basic({wait: () => Promise.reject(abort)});
    expect(await failure(basic.runAsync('10 WAIT 0'))).toMatchObject({name: 'AbortError'});
    expect(basic.state).toMatchObject({status: 'halted', diagnostic: null});
    const controller = new AbortController();
    const cancelling = new Basic({
      wait() {
        controller.abort();
        return Promise.reject(new Error('late provider failure'));
      },
    });
    expect(
      await failure(cancelling.runAsync('10 WAIT 0', {signal: controller.signal})),
    ).toMatchObject({name: 'AbortError'});
    expect(cancelling.state).toMatchObject({status: 'halted', diagnostic: null});
  });

  it.each(['throw', 'reject', 'non-error'] as const)(
    'locates a host %s failure and preserves the underlying cause',
    async (mode) => {
      const cause = new Error('timer failure');
      const basic = new Basic({
        wait() {
          if (mode === 'throw') throw cause;
          return new Promise<void>((_resolve, reject) => {
            // Simulate an untyped host violating the Error rejection contract.
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(mode === 'non-error' ? 'broken' : cause);
          });
        },
      });
      const error = await failure(basic.runAsync('10 WAIT 1\n20 PRINT "skip"'));
      expect(error).toMatchObject({diagnostic: {code: 'WAIT_FAILED', label: 10, column: 4}});
      expect((error as Error).cause).toEqual(
        mode === 'non-error' ? new Error('Host wait failed', {cause: 'broken'}) : cause,
      );
      expect(basic.state.status).toBe('error');
    },
  );

  it('binds and snapshots wait callbacks, validates them, and rejects host reentrancy', async () => {
    const provider = {
      calls: [] as number[],
      wait(ms: number) {
        this.calls.push(ms);
        return Promise.resolve();
      },
    };
    const basic = new Basic(provider);
    provider.wait = () => {
      throw new Error('replaced');
    };
    await basic.runAsync('10 WAIT 2');
    expect(provider.calls).toEqual([2]);
    expect(Object.isFrozen(basic.host)).toBe(true);
    expect(() => {
      Reflect.apply(createHost, undefined, [{wait: 1}]);
    }).toThrow('Host wait must be a function');
    let guarded: Basic;
    guarded = new Basic({
      wait() {
        guarded.reset();
        return Promise.resolve();
      },
    });
    const error = await failure(guarded.runAsync('10 WAIT 0'));
    expect((error as Error).cause).toEqual(new Error('Cannot change execution during a statement'));
    guarded = new Basic({
      random() {
        expect(() => guarded.cancel()).toThrow('Cannot change execution during a statement');
        return 0.5;
      },
      wait: () => Promise.resolve(),
    });
    await guarded.runAsync('10 WAIT RND()');
  });
});

describe('default WAIT timer ownership', () => {
  it('schedules exact normalized durations and removes timers/listeners on success, abort and already-aborted calls', async () => {
    const callbacks: (() => void)[] = [];
    const handle = {timer: true} as unknown as ReturnType<typeof setTimeout>;
    const schedule = spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      callbacks.push(callback);
      return handle;
    }) as typeof setTimeout);
    const clear = spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
    try {
      const controller = new AbortController();
      const pending = defaultWait(2147483647, {signal: controller.signal});
      expect(schedule.mock.calls[0][1]).toBe(2147483647);
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
      callbacks.shift()!();
      await pending;
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
      expect(clear).not.toHaveBeenCalled();
      const cancelled = failure(defaultWait(5, {signal: controller.signal}));
      controller.abort();
      expect(await cancelled).toMatchObject({name: 'AbortError'});
      expect(clear).toHaveBeenCalledWith(handle);
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
      expect(await failure(defaultWait(3, {signal: controller.signal}))).toMatchObject({
        name: 'AbortError',
      });
      const noSignal = defaultWait(0);
      callbacks.at(-1)!();
      await noSignal;
      expect(schedule.mock.calls.at(-1)![1]).toBe(0);
    } finally {
      schedule.mockRestore();
      clear.mockRestore();
    }
  });

  it('WAIT zero crosses a task boundary rather than a chain of microtasks', async () => {
    const order: string[] = [];
    const basic = new Basic({write: (text) => order.push(text)});
    const hostTask = setTimeout(() => order.push('host task'), 0);
    const running = basic.runAsync('10 WAIT 0\n20 PRINT "after"');
    queueMicrotask(() => order.push('microtask'));
    try {
      expect((await running).status).toBe('halted');
      expect(order).toEqual(['microtask', 'host task', 'after\n']);
    } finally {
      clearTimeout(hostTask);
    }
  });
});
