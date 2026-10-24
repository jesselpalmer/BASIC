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
    new Basic(host).run('10 CLS\n20 PRINT "hello"\n30 ABS "-3.14"');
    expect(host.clear).toHaveBeenCalledTimes(1);
    expect(host.write.mock.calls).toEqual([['hello\n'], ['3.14\n']]);
  });

  it('preserves host method receivers for input and randomness', async () => {
    class Host {
      value: string;
      constructor() {
        this.value = 'answer';
      }
      async readLine() {
        return this.value;
      }
      random() {
        return 0.41;
      }
    }
    const program = new Basic(new Host());
    expect(await program.host.readLine('Question? ')).toBe('answer');
    expect(program.host.random()).toBe(0.41);
    expect(Object.keys(program.host).sort()).toEqual(['clear', 'random', 'readLine', 'write']);
  });

  it('has a quiet default host and explicit unsupported input', async () => {
    const host = createHost();
    expect(() => new Basic().run('10 PRINT "discarded"')).not.toThrow();
    await expect(host.readLine()).rejects.toThrow('Input is not supported');
    expect(() => Reflect.apply(createHost, undefined, [{write: 'bad'}])).toThrow(
      'must be a function',
    );
  });
});
