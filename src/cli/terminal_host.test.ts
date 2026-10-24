import {once} from 'node:events';
import {describe, it, expect, beforeEach, afterEach} from 'bun:test';
import {jest} from 'bun:test';
import {PassThrough} from 'node:stream';
import TerminalHost from './terminal_host.ts';

describe('TerminalHost input lifecycle', () => {
  it('emits cursor reset and display erase only for a TTY output', () => {
    const stream = Object.assign(new PassThrough(), {isTTY: true});
    const tty = new TerminalHost({output: stream});
    tty.clear();
    const chunks: Buffer[] = [];
    for (;;) {
      const chunk: unknown = stream.read();
      if (chunk === null) break;
      if (!Buffer.isBuffer(chunk)) throw new Error('Expected binary output');
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks).toString()).toBe('\u001b[1;1H\u001b[0J');
    stream.isTTY = false;
    tty.clear();
    expect(stream.read()).toBeNull();
    tty.close();
    stream.destroy();
  });
  let input: PassThrough;
  let output: PassThrough;
  let host: TerminalHost;

  beforeEach(() => {
    input = new PassThrough();
    output = new PassThrough();
    host = new TerminalHost({input, output, errorOutput: output});
  });

  afterEach(() => {
    host.close();
    input.destroy();
    output.destroy();
  });

  it('does not attach input listeners until a request starts', () => {
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('end')).toBe(0);
    host.close();
    expect(input.listenerCount('data')).toBe(0);
  });

  it('retains piped lines through EOF and removes listeners', async () => {
    const first = host.readLine('First? ');
    input.end('one\r\ntwo\nthree');
    expect(await first).toBe('one');
    expect(await host.readLine()).toBe('two');
    expect(await host.readLine()).toBe('three');
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('end')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('returns EOF when input ended before the first lazy read', async () => {
    input.resume();
    const ended = once(input, 'end');
    input.end();
    await ended;
    expect(await host.readLine()).toBeNull();
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('returns EOF when input was already destroyed', async () => {
    const closed = once(input, 'close');
    input.destroy();
    await closed;
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('propagates an error recorded before lazy initialization', async () => {
    const failure = new Error('earlier failure');
    const errored = once(input, 'error');
    input.destroy(failure);
    await errored;
    expect(await host.readLine().catch((error: unknown) => error)).toBe(failure);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('settles a pending read on input close and removes abort listeners', async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const externalClose = jest.fn();
    input.on('close', externalClose);
    const pending = host.readLine('', {signal: controller.signal});
    input.destroy();
    expect(await pending).toBeNull();
    expect(await host.readLine()).toBeNull();
    expect(externalClose).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('end')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(1);
    input.removeListener('close', externalClose);
    controller.abort();
    host.close();
    host.close();
  });

  it('drains queued complete lines before EOF after abrupt close', async () => {
    const first = host.readLine();
    input.write('one\ntwo\nthree\npartial');
    expect(await first).toBe('one');
    const closed = once(input, 'close');
    input.destroy();
    await closed;
    expect(await host.readLine()).toBe('two');
    expect(await host.readLine()).toBe('three');
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('does not destroy caller input on host close', async () => {
    const pending = host.readLine();
    host.close();
    expect(await pending).toBeNull();
    expect(input.destroyed).toBe(false);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('settles pending input and closes idempotently', async () => {
    const result = host.readLine();
    host.close();
    host.close();
    expect(await result).toBeNull();
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('rejects cancellation and allows a fresh request', async () => {
    const controller = new AbortController();
    const result = host.readLine('', {signal: controller.signal});
    const rejection = result.catch((error: unknown) => error);
    controller.abort();
    expect(await rejection).toMatchObject({name: 'AbortError'});
    const next = host.readLine();
    input.write('new request\n');
    expect(await next).toBe('new request');
  });

  it('does not open input for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = await host
      .readLine('', {signal: controller.signal})
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({name: 'AbortError'});
    expect(input.listenerCount('data')).toBe(0);
  });

  it('rejects overlapping requests without discarding the first', async () => {
    const first = host.readLine();
    const failure = await host.readLine().catch((error: unknown) => error);
    expect(failure).toMatchObject({message: 'Only one input request may be pending'});
    input.write('first\n');
    expect(await first).toBe('first');
  });

  it('removes the abort listener after input settles', async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const result = host.readLine('', {signal: controller.signal});
    input.write('done\n');
    expect(await result).toBe('done');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    const next = host.readLine();
    controller.abort();
    input.write('next\n');
    expect(await next).toBe('next');
  });

  it('rejects stream errors and releases owned resources', async () => {
    const result = host.readLine();
    const rejection = result.catch((error: unknown) => error);
    input.emit('error', new Error('broken input'));
    expect(await rejection).toMatchObject({message: 'broken input'});
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('normalizes non-Error output failures and releases listeners', async () => {
    host.write = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Simulate an untyped host callback.
      throw 'broken output';
    };
    const failure = await host.readLine('Prompt? ').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({message: 'broken output'});
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('cleans up if writing the prompt fails', async () => {
    host.write = () => {
      throw new Error('broken output');
    };
    const failure = await host.readLine('Prompt? ').catch((error: unknown) => error);
    expect(failure).toMatchObject({message: 'broken output'});
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });
});
