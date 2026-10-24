import {describe, it, expect} from 'bun:test';
import {jest} from 'bun:test';
import Basic from './basic.ts';
import {createHost} from './core/host.ts';

describe('Basic host boundary', () => {
  it('constructs quietly without starting a session', () => {
    const host = {
      write: jest.fn(),
      clear: jest.fn(),
      readLine: jest.fn<() => Promise<string | null>>(),
    };
    const program = new Basic(host);
    expect(program.status).toBe('ready');
    for (const callback of Object.values(host)) {
      expect(callback).not.toHaveBeenCalled();
    }
  });

  it('routes output and clear through the injected host', () => {
    const host = {write: jest.fn(), clear: jest.fn()};
    new Basic(host).run('10 CLS\n20 PRINT "hello"\n30 PRINT ABS(-3.14)');
    expect(host.clear).toHaveBeenCalledTimes(1);
    expect(host.write.mock.calls).toEqual([['hello\n'], ['3.14\n']]);
  });

  it('preserves host method receivers for input and randomness', async () => {
    class Host {
      value: string;
      sample = 0.41;
      output: string[] = [];
      clears = 0;
      constructor() {
        this.value = 'answer';
      }
      readLine() {
        return Promise.resolve(this.value);
      }
      random() {
        return this.sample;
      }
      write(text: string) {
        this.output.push(`${this.value}:${text}`);
      }
      clear() {
        this.clears++;
      }
    }
    const receiver = new Host();
    const program = new Basic(receiver);
    expect(await program.host.readLine('Question? ')).toBe('answer');
    expect(program.host.random()).toBe(0.41);
    program.run('10 CLS\n20 PRINT "hello"');
    expect(receiver.output).toEqual(['answer:hello\n']);
    expect(receiver.clears).toBe(1);
    expect(Object.keys(program.host).sort()).toEqual(['clear', 'random', 'readLine', 'write']);
  });

  it.each(['write', 'clear'] as const)('recovers after an injected %s failure', (callback) => {
    const output: string[] = [];
    const host = {
      write: jest.fn((text: string) => {
        output.push(text);
      }),
      clear: jest.fn<() => void>(),
    };
    const failure = new Error(`${callback} failed`);
    host[callback].mockImplementationOnce(() => {
      throw failure;
    });
    const program = new Basic(host);
    let caught;
    try {
      program.run('10 CLS\n20 PRINT "first"\n30 PRINT "skipped"');
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({cause: failure, diagnostic: {code: 'HOST_ERROR'}});
    expect(program.status).toBe('error');
    expect(output).toEqual([]);
    program.readLine('40 PRINT "also skipped"');
    expect(output).toEqual([]);
    program.reset();
    program.readLine('10 PRINT "reset"');
    program.run('10 PRINT "new run"');
    expect(output).toEqual(['reset\n', 'new run\n']);
    expect(program.status).toBe('halted');
  });

  it('has a quiet default host and explicit unsupported input', async () => {
    const host = createHost();
    expect(() => new Basic().run('10 PRINT "discarded"')).not.toThrow();
    const failure: unknown = await host.readLine().catch((error: unknown) => error);
    expect(failure).toMatchObject({message: 'Input is not supported by this host'});
    expect(() => {
      Reflect.apply(createHost, undefined, [{write: 'bad'}]);
    }).toThrow('must be a function');
  });
});
