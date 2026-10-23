import {PassThrough} from 'stream';
import TerminalHost from './terminal_host';

describe('TerminalHost input lifecycle', () => {
  let input;
  let output;
  let host;

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
    const rejection = expect(result).rejects.toMatchObject(
        {name: 'AbortError'},
    );
    controller.abort();
    await rejection;
    const next = host.readLine();
    input.write('new request\n');
    expect(await next).toBe('new request');
  });

  it('does not open input for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(host.readLine('', {signal: controller.signal}))
        .rejects.toMatchObject({name: 'AbortError'});
    expect(input.listenerCount('data')).toBe(0);
  });

  it('rejects overlapping requests without discarding the first', async () => {
    const first = host.readLine();
    await expect(host.readLine()).rejects.toThrow('Only one input request');
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
    const rejection = expect(result).rejects.toThrow('broken input');
    input.emit('error', new Error('broken input'));
    await rejection;
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('cleans up if writing the prompt fails', async () => {
    host.write = () => {
      throw new Error('broken output');
    };
    await expect(host.readLine('Prompt? ')).rejects.toThrow('broken output');
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });
});
