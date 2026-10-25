import {describe, expect, it, jest} from 'bun:test';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseLine} from '../index.ts';
import type {InputOptions} from './types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}

function scripted(values: (string | null)[]) {
  const output: string[] = [];
  const prompts: string[] = [];
  const basic = new Basic({
    write(text) {
      output.push(text);
    },
    readLine(prompt) {
      prompts.push(prompt ?? '');
      return Promise.resolve(values.shift() ?? null);
    },
  });
  return {basic, output, prompts};
}

function pendingHost() {
  const requests: {
    prompt: string;
    signal?: AbortSignal;
    reply: ReturnType<typeof deferred<string | null>>;
  }[] = [];
  const output: string[] = [];
  const basic = new Basic({
    write: (text) => output.push(text),
    readLine(prompt, options) {
      const reply = deferred<string | null>();
      requests.push({prompt: prompt ?? '', signal: options?.signal, reply});
      return reply.promise;
    },
  });
  return {basic, requests, output};
}

const watch = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

describe('INPUT grammar', () => {
  it('parses a decoded literal prompt and normalized target with original spans', () => {
    const source = '\t20 input "Say ""Hi"""; name$';
    const line = parseLine(source, {line: 3, offset: 50});
    expect(line?.statement).toMatchObject({
      type: 'InputStatement',
      prompt: {type: 'StringLiteral', value: 'Say "Hi"', raw: '"Say ""Hi"""'},
      target: {
        type: 'Variable',
        name: 'NAME$',
        location: {
          start: {
            line: 3,
            column: source.indexOf('name$') + 1,
            offset: 50 + source.indexOf('name$'),
          },
        },
      },
    });
    expect(Object.isFrozen(line?.statement)).toBe(true);
    expect(parseLine('10 INPUT N')?.statement).toMatchObject({
      type: 'InputStatement',
      prompt: null,
      target: {name: 'N'},
    });
  });

  it.each([
    '10 INPUT',
    '10 INPUT "Prompt" N',
    '10 INPUT "Prompt";',
    '10 INPUT A,,B',
    '10 INPUT A;B',
    '10 INPUT A+1',
    '10 INPUT (A)',
    '10 INPUT 3',
    '10 INPUT ABS',
    '10 INPUT P$;N',
    '10 INPUT "a"+"b";N',
  ])('rejects unsupported input syntax: %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });
});

describe('typed input and prompts', () => {
  it('runs the greeting example with exact string whitespace and decoded prompts', async () => {
    const {basic, output, prompts} = scripted(['  MiX "Hi"  ']);
    expect(
      (await basic.runAsync('10 INPUT "What is your name"; NAME$\n20 PRINT "Hello, ";NAME$;"!"'))
        .status,
    ).toBe('halted');
    expect(prompts).toEqual(['What is your name? ']);
    expect(output).toEqual(['Hello,   MiX "Hi"  !\n']);
  });

  it.each(['', 'RUN', 'EXIT', '20 PRINT "data"', '  tabs\tand spaces  '])(
    'accepts string input literally: %s',
    async (value) => {
      const {basic, output, prompts} = scripted([value]);
      await basic.runAsync('10 INPUT ""; VALUE$\n20 PRINT VALUE$');
      expect(output).toEqual([value + '\n']);
      expect(prompts).toEqual(['? ']);
    },
  );

  it.each(['-3.14', '+3.14', '-0', '0', '.5', '1.', '001.20', ' \t-.5\t ', '1e2', '-8.84361E-04'])(
    'accepts complete finite signed decimal %s',
    async (text) => {
      const {basic, output, prompts} = scripted([text]);
      await basic.runAsync('10 INPUT N\n20 PRINT N');
      expect(output).toEqual([String(Number(text.trim())) + '\n']);
      expect(prompts).toEqual(['? ']);
    },
  );

  it.each([
    '',
    ' ',
    '\t',
    '12oops',
    '1.2.3',
    '0x10',
    '0b10',
    '1e+',
    'Infinity',
    'NaN',
    '9'.repeat(400),
    '\n1',
    '1\r',
    '\u00a01',
    '+',
    '.',
  ])('retries invalid numeric input without executing later statements: %s', async (text) => {
    const {basic, output, prompts} = scripted([text, '  -1.6\t']);
    await basic.runAsync('10 LET N = 7\n20 INPUT "Number"; N\n30 PRINT N*2');
    expect(prompts).toEqual(['Number? ', 'Number? ']);
    expect(output).toEqual(['Invalid number; please enter a finite decimal.\n', '-3.2\n']);
  });

  it('reruns with fresh variables and supports the loaded snapshot', async () => {
    const {basic, output} = scripted(['one', 'two']);
    await basic.runAsync('10 INPUT A$\n20 PRINT A$');
    await basic.runAsync();
    expect(output).toEqual(['one\n', 'two\n']);
    const error = await watch(basic.runAsync('10 PRINT A$'));
    expect(error).toMatchObject({diagnostic: {code: 'UNDEFINED_VARIABLE'}});
  });
});

describe('waiting, stepping, and cancellation', () => {
  it('waits at INPUT, then completes exactly one step before later statements', async () => {
    const {basic, requests, output} = pendingHost();
    basic.reset('10 INPUT "Value"; N\n20 PRINT N');
    const result = basic.stepAsync();
    expect(basic.state).toMatchObject({
      status: 'waiting',
      currentLocation: {label: 10},
      nextLocation: null,
      diagnostic: null,
    });
    expect(output).toEqual([]);
    expect(requests[0].prompt).toBe('Value? ');
    expect(requests[0].signal?.aborted).toBe(false);
    expect(() => basic.step()).toThrow('Input is already pending');
    expect(await watch(basic.stepAsync())).toBeInstanceOf(Error);
    expect(() => basic.readLine('30 END')).toThrow('Input is already pending');
    expect(await watch(basic.readLineAsync('30 END'))).toBeInstanceOf(Error);
    expect(basic.status).toBe('waiting');
    requests[0].reply.resolve('4');
    expect(await result).toMatchObject({
      status: 'running',
      currentLocation: {label: 10},
      nextLocation: {label: 20},
    });
    expect(output).toEqual([]);
    expect(basic.step().status).toBe('halted');
    expect(output).toEqual(['4\n']);
  });

  it('halts when INPUT is the last statement and keeps halted/error steps inert', async () => {
    const {basic} = scripted(['1']);
    basic.reset('10 INPUT N');
    expect((await basic.stepAsync()).status).toBe('halted');
    expect((await basic.stepAsync()).status).toBe('halted');
    expect((await basic.readLineAsync('20 INPUT N')).status).toBe('halted');
    await watch(basic.runAsync('10 PRINT MISSING'));
    expect((await basic.stepAsync()).status).toBe('error');
    expect((await basic.readLineAsync('20 INPUT N')).status).toBe('error');
  });

  it('cancels promptly even if the host ignores abort and later returns a value', async () => {
    const {basic, requests, output} = pendingHost();
    const old = watch(basic.runAsync('10 INPUT N\n20 PRINT "old";N'));
    expect(basic.cancel().status).toBe('halted');
    expect(requests[0].signal?.aborted).toBe(true);
    expect(await old).toMatchObject({name: 'AbortError'});
    basic.run('10 LET N = 9\n20 PRINT N');
    const current = basic.state;
    requests[0].reply.resolve('123');
    await requests[0].reply.promise;
    expect(basic.state).toEqual(current);
    expect(output).toEqual(['9\n']);
  });

  it('reset invalidates old callbacks without resuming or damaging a new waiting run', async () => {
    const {basic, requests, output} = pendingHost();
    const old = watch(basic.runAsync('10 INPUT N\n20 PRINT "old"'));
    const fresh = basic.runAsync('30 INPUT N\n40 PRINT "new:";N');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(requests).toHaveLength(2);
    requests[0].reply.resolve('100');
    await requests[0].reply.promise;
    expect(basic.state).toMatchObject({status: 'waiting', currentLocation: {label: 30}});
    requests[1].reply.resolve('5');
    expect((await fresh).status).toBe('halted');
    expect(output).toEqual(['new:5\n']);
  });

  it('consumes late rejections from an abandoned host promise', async () => {
    const {basic, requests, output} = pendingHost();
    const old = watch(basic.stepAsync());
    await old; // Empty programs are valid async steps.
    const running = watch(basic.runAsync('10 INPUT N'));
    basic.reset('20 PRINT "safe"');
    expect(await running).toMatchObject({name: 'AbortError'});
    requests[0].reply.reject(new Error('late host failure'));
    await requests[0].reply.promise.catch(() => {});
    expect((await basic.stepAsync()).status).toBe('halted');
    expect(output).toEqual(['safe\n']);
  });

  it('honors external cancellation and removes its own signal listener', async () => {
    const {basic, requests} = pendingHost();
    const controller = new AbortController();
    const added = jest.spyOn(controller.signal, 'addEventListener');
    const removed = jest.spyOn(controller.signal, 'removeEventListener');
    const result = watch(basic.runAsync('10 INPUT N', {signal: controller.signal}));
    controller.abort();
    expect(await result).toMatchObject({name: 'AbortError'});
    expect(requests[0].signal?.aborted).toBe(true);
    expect(basic.state).toMatchObject({status: 'halted', diagnostic: null, nextLocation: null});
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0][1]);
  });

  it('does not read from the host when the supplied signal is already aborted', async () => {
    const {basic, requests} = pendingHost();
    const controller = new AbortController();
    controller.abort();
    expect(await watch(basic.runAsync('10 INPUT N', {signal: controller.signal}))).toMatchObject({
      name: 'AbortError',
    });
    expect(requests).toHaveLength(0);
    expect(basic.status).toBe('halted');
  });

  it('cancels an answer already returned by the host before it can be consumed', async () => {
    const {basic, requests, output} = pendingHost();
    const controller = new AbortController();
    const result = watch(basic.runAsync('10 INPUT N\n20 PRINT N', {signal: controller.signal}));
    requests[0].reply.resolve('5');
    // Let the host promise settle, then abort before the input continuation.
    await Promise.resolve();
    controller.abort();
    expect(await result).toMatchObject({name: 'AbortError'});
    expect(output).toEqual([]);
    expect(basic.status).toBe('halted');
    expect(basic.cancel().status).toBe('halted');
  });

  it('does not ask again if cancellation occurs while displaying a retry', async () => {
    const controller = new AbortController();
    const readLine = jest.fn(() => Promise.resolve('bad'));
    const basic = new Basic({
      readLine,
      write() {
        controller.abort();
      },
    });
    expect(await watch(basic.runAsync('10 INPUT N', {signal: controller.signal}))).toMatchObject({
      name: 'AbortError',
    });
    expect(readLine).toHaveBeenCalledTimes(1);
  });

  it('keeps two pending runtime instances independent', async () => {
    const first = pendingHost();
    const second = pendingHost();
    const one = first.basic.runAsync('10 INPUT N\n20 PRINT N');
    const two = second.basic.runAsync('10 INPUT N\n20 PRINT N');
    second.requests[0].reply.resolve('2');
    await two;
    expect(first.basic.status).toBe('waiting');
    first.requests[0].reply.resolve('1');
    await one;
    expect(first.output).toEqual(['1\n']);
    expect(second.output).toEqual(['2\n']);
  });

  it('does not let an old async run advance a new run between normal statements', async () => {
    const {basic, output} = scripted([]);
    const old = watch(basic.runAsync('10 PRINT "already done"\n20 PRINT "old skipped"'));
    basic.reset('30 PRINT "new"');
    expect(await old).toMatchObject({name: 'AbortError'});
    expect(basic.state).toMatchObject({status: 'ready', nextLocation: {label: 30}});
    basic.step();
    expect(output).toEqual(['already done\n', 'new\n']);
  });

  it('supports string input in the immediate adapter without reading another editor entry', async () => {
    const {basic, output} = scripted(['RUN']);
    expect((await basic.readLineAsync('10 INPUT A$')).status).toBe('running');
    await basic.readLineAsync('20 PRINT A$');
    expect(output).toEqual(['RUN\n']);
    expect((await basic.readLineAsync('30 END')).status).toBe('halted');
  });

  it.each(['run', 'step', 'readLine'] as const)(
    'keeps synchronous %s explicit about INPUT',
    (method) => {
      const {basic, prompts} = scripted(['1']);
      let error;
      try {
        if (method === 'step') {
          basic.reset('10 INPUT N');
          basic.step();
        } else basic[method]('10 INPUT N');
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(BasicRuntimeError);
      expect(error).toMatchObject({diagnostic: {code: 'ASYNC_INPUT_REQUIRED', label: 10}});
      expect(basic.status).toBe('error');
      expect(prompts).toEqual([]);
    },
  );

  it('validates all INPUT grammar before asking, and allows unreachable input in synchronous runs', async () => {
    const {basic, prompts} = scripted([]);
    expect(await watch(basic.runAsync('10 INPUT N\n20 INPUT A,,B'))).toBeInstanceOf(
      BasicSyntaxError,
    );
    expect(basic.run('10 END\n20 INPUT N').status).toBe('halted');
    expect(prompts).toEqual([]);
  });
});

describe('input failure paths', () => {
  it('locates EOF, stops later effects, and permits a new run', async () => {
    const {basic, output} = scripted([null, '5']);
    const error = await watch(basic.runAsync('30 PRINT "skipped"\r\n20 INPUT N'));
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(error).toMatchObject({
      diagnostic: {code: 'INPUT_ENDED', label: 20, line: 2, column: 4, offset: 23},
    });
    expect(basic.state).toMatchObject({
      status: 'error',
      currentLocation: {label: 20},
      nextLocation: null,
    });
    expect(output).toEqual([]);
    await basic.runAsync('10 INPUT N\n20 PRINT N');
    expect(output).toEqual(['5\n']);
  });

  it('wraps rejected and synchronous host failures with the original cause', async () => {
    for (const synchronous of [false, true]) {
      const cause = new Error('host failed');
      const basic = new Basic({
        readLine() {
          if (synchronous) throw cause;
          return Promise.reject(cause);
        },
      });
      expect(await watch(basic.runAsync('10 INPUT N'))).toMatchObject({
        cause,
        diagnostic: {code: 'INPUT_FAILED', label: 10},
      });
    }
  });

  it('rejects invalid host return values and untyped rejection reasons safely', async () => {
    for (const value of [42, undefined, {}]) {
      const host = {};
      Reflect.set(host, 'readLine', () => Promise.resolve(value));
      expect(await watch(new Basic(host).runAsync('10 INPUT A$'))).toMatchObject({
        diagnostic: {code: 'INPUT_FAILED'},
      });
    }
    const host = {};
    Reflect.set(host, 'readLine', () => ({
      then(_yes: unknown, no: (cause: unknown) => void) {
        no('untyped failure');
      },
    }));
    expect(await watch(new Basic(host).runAsync('10 INPUT N'))).toMatchObject({
      diagnostic: {code: 'INPUT_FAILED'},
    });
  });

  it('treats a host AbortError as cancellation rather than a BASIC input failure', async () => {
    const error = new Error('host cancelled');
    error.name = 'AbortError';
    const basic = new Basic({readLine: () => Promise.reject(error)});
    expect(await watch(basic.runAsync('10 INPUT N'))).toMatchObject({name: 'AbortError'});
    expect(basic.status).toBe('halted');
  });

  it('locates retry-output failures', async () => {
    const cause = new Error('write failed');
    const basic = new Basic({
      readLine: () => Promise.resolve('bad'),
      write() {
        throw cause;
      },
    });
    expect(await watch(basic.runAsync('10 INPUT N'))).toMatchObject({
      cause,
      diagnostic: {code: 'HOST_ERROR', label: 10},
    });
  });

  it('guards reset/cancel from inside host callbacks and cleans up successful reads', async () => {
    const controller = new AbortController();
    const added = jest.spyOn(controller.signal, 'addEventListener');
    const removed = jest.spyOn(controller.signal, 'removeEventListener');
    const attempts: string[] = [];
    const basic = new Basic({
      readLine(_prompt, options: InputOptions = {}) {
        expect(options.signal).toBeDefined();
        for (const method of ['reset', 'cancel'] as const) {
          try {
            basic[method]();
          } catch (error) {
            if (error instanceof Error) attempts.push(error.message);
            else throw error;
          }
        }
        return Promise.resolve('1');
      },
    });
    await basic.runAsync('10 INPUT N', {signal: controller.signal});
    expect(attempts).toEqual([
      'Cannot change execution during a statement',
      'Cannot change execution during a statement',
    ]);
    expect(removed).toHaveBeenCalledWith('abort', added.mock.calls[0][1]);
  });
});
