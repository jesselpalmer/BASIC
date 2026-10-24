import {getEventListeners, once} from 'node:events';
import {describe, it, expect, beforeEach, afterEach} from 'bun:test';
import {jest} from 'bun:test';
import {PassThrough} from 'node:stream';
import TerminalHost from './terminal_host.ts';
import ReadlineInput from './readline_input.ts';

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

  it('discards a non-TTY partial entry without losing complete queued lines', async () => {
    host.discardEntry();
    expect(input.listenerCount('data')).toBe(0);
    const first = host.readLine();
    input.write('one\ntwo\npartial');
    expect(await first).toBe('one');
    host.discardEntry();
    expect(input.destroyed).toBe(false);
    expect(await host.readLine()).toBe('two');
    const fresh = host.readLine();
    input.end('fresh\n');
    expect(await fresh).toBe('fresh');
    expect(await host.readLine()).toBeNull();
    host.discardEntry();
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
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

  it('discards complete queued lines when explicitly closed', async () => {
    const first = host.readLine();
    input.write('first\nqueued\n');
    expect(await first).toBe('first');
    host.close();
    expect(await host.readLine()).toBeNull();
    expect(input.destroyed).toBe(false);
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

  it('queues lines arriving after a cancelled request for the next reader', async () => {
    const controller = new AbortController();
    const rejection = host
      .readLine('', {signal: controller.signal})
      .catch((error: unknown) => error);
    controller.abort();
    expect(await rejection).toMatchObject({name: 'AbortError'});
    input.end('retained\n');
    expect(await host.readLine()).toBe('retained');
    expect(await host.readLine()).toBeNull();
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

  it('reserves a read before writing its prompt and rejects nested reads', async () => {
    let nested!: Promise<unknown>;
    output.once('data', () => {
      nested = host.readLine('Nested? ').catch((error: unknown) => error);
    });
    const first = host.readLine('First? ');
    input.write('first answer\n');
    expect(await first).toBe('first answer');
    expect(await nested).toMatchObject({message: 'Only one input request may be pending'});
  }, 1000);

  it('propagates an input error raised while writing the prompt', async () => {
    const failure = new Error('input failed during prompt');
    output.once('data', () => input.emit('error', failure));
    expect(await host.readLine('Prompt? ').catch((error: unknown) => error)).toBe(failure);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('preserves a queued line when prompt output cancels its reader', async () => {
    const first = host.readLine();
    input.write('first\nqueued\n');
    expect(await first).toBe('first');
    const controller = new AbortController();
    output.once('data', () => controller.abort());
    const cancelled = host
      .readLine('Prompt? ', {signal: controller.signal})
      .catch((error: unknown) => error);
    expect(await cancelled).toMatchObject({name: 'AbortError'});
    expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
    expect(await host.readLine()).toBe('queued');
  }, 1000);

  it('rejects a prompt failure even when its callback has already supplied a line', async () => {
    const failure = new Error('prompt failed after supplying input');
    host.write = () => {
      input.write('must not be delivered\n');
      throw failure;
    };
    expect(await host.readLine('Prompt? ').catch((error: unknown) => error)).toBe(failure);
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  });

  it('drains lines supplied before a prompt callback closes the input stream', async () => {
    output.once('data', () => {
      input.write('first\nsecond\n');
      input.emit('close');
    });
    expect(await host.readLine('Prompt? ')).toBe('first');
    expect(await host.readLine()).toBe('second');
    expect(await host.readLine()).toBeNull();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('does not let an aborted prompt callback close a replacement read when it throws', async () => {
    const controller = new AbortController();
    let replacement!: Promise<string | null>;
    host.write = (prompt) => {
      if (prompt === 'Old? ') {
        controller.abort();
        replacement = host.readLine('New? ');
        throw new Error('old prompt failed after replacement');
      }
      return true;
    };
    const cancelled = host
      .readLine('Old? ', {signal: controller.signal})
      .catch((error: unknown) => error);
    expect(await cancelled).toMatchObject({name: 'AbortError'});
    input.end('replacement answer\n');
    expect(await replacement).toBe('replacement answer');
    expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
  }, 1000);

  it('settles a read closed by its prompt callback without reopening input', async () => {
    host.write = () => {
      host.close();
      return true;
    };
    expect(await host.readLine('Prompt? ')).toBeNull();
    expect(await host.readLine()).toBeNull();
    expect(input.destroyed).toBe(false);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  });

  it('preserves complete lines when a prompt callback replaces readline', async () => {
    const first = host.readLine();
    input.write('first\nqueued\npartial');
    expect(await first).toBe('first');
    output.once('data', () => host.discardEntry());
    expect(await host.readLine('Next? ')).toBe('queued');
    const fresh = host.readLine();
    input.end('fresh\n');
    expect(await fresh).toBe('fresh');
    expect(await host.readLine()).toBeNull();
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

it('releases a TTY interface if its stream closes the host during initialization', async () => {
  let rawMode = false;
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode(enabled: boolean) {
      if (enabled) host.close();
      rawMode = enabled;
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const host = new TerminalHost({input, output});
  try {
    expect(await host.readLine('Prompt? ')).toBeNull();
    expect(rawMode).toBe(false);
    expect(input.listenerCount('keypress')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
    expect(input.destroyed).toBe(false);
    expect(await host.readLine()).toBeNull();
  } finally {
    host.close();
    input.destroy();
    output.destroy();
  }
}, 1000);

it('finishes TTY initialization before starting a replacement read and its prompt', async () => {
  const controller = new AbortController();
  let replacement!: Promise<string | null>;
  let replaced = false;
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode(enabled: boolean) {
      if (enabled && !replaced) {
        replaced = true;
        controller.abort();
        replacement = host.readLine('New? ');
      }
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const host = new TerminalHost({input, output});
  let text = '';
  let answered = false;
  output.on('data', (chunk: Buffer) => {
    text += chunk.toString();
    if (!answered && text.includes('New? ')) {
      answered = true;
      input.write('replacement answer\n');
    }
  });
  try {
    const cancelled = host
      .readLine('Old? ', {signal: controller.signal})
      .catch((error: unknown) => error);
    expect(await cancelled).toMatchObject({name: 'AbortError'});
    expect(await replacement).toBe('replacement answer');
    expect(input.listenerCount('keypress')).toBe(0);
    expect(input.listenerCount('data')).toBe(1);
    const next = host.readLine();
    input.end('next answer\n');
    expect(await next).toBe('next answer');
    host.close();
    expect(input.listenerCount('keypress')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
  } finally {
    host.close();
    input.destroy();
    output.destroy();
  }
}, 1000);

for (const failureMode of ['throw', 'emit'] as const) {
  it(`releases only owned input callbacks when raw-mode setup fails by ${failureMode}`, async () => {
    const failure = new Error('raw mode failed');
    const rawModes: boolean[] = [];
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode(enabled: boolean) {
        rawModes.push(enabled);
        if (enabled) {
          if (failureMode === 'throw') throw failure;
          input.emit('error', failure);
        }
        return input;
      },
    });
    const output = Object.assign(new PassThrough(), {isTTY: true});
    const external = {
      data: jest.fn(),
      end: jest.fn(),
      error: jest.fn(),
      close: jest.fn(),
      keypress: jest.fn(),
    };
    for (const event of ['data', 'end', 'error', 'close', 'keypress'] as const) {
      input.on(event, external[event]);
    }
    const resize = jest.fn();
    output.on('resize', resize);
    const host = new TerminalHost({input, output});
    const controller = new AbortController();
    try {
      const result = await host
        .readLine('Prompt? ', {signal: controller.signal})
        .catch((error: unknown) => error);
      expect(result).toBe(failure);
      host.close();
      host.close();
      expect(getEventListeners(controller.signal, 'abort')).toEqual([]);
      expect(rawModes).toEqual([true, false]);
      expect(input.destroyed).toBe(false);
      expect(output.destroyed).toBe(false);
      for (const event of ['data', 'end', 'error', 'close', 'keypress'] as const) {
        expect(input.listeners(event)).toEqual([external[event]]);
      }
      expect(output.listeners('resize')).toEqual([resize]);
      input.emit('error', failure);
      expect(external.error).toHaveBeenCalledTimes(failureMode === 'emit' ? 2 : 1);
    } finally {
      host.close();
      input.destroy();
      output.destroy();
    }
  }, 1000);
}

it('preserves a raw-mode setup failure when the disconnected stream also rejects restoration', async () => {
  const failure = new Error('raw mode failed');
  const rawModes: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode(enabled: boolean) {
      rawModes.push(enabled);
      throw enabled ? failure : new Error('restoration failed');
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const host = new TerminalHost({input, output});
  try {
    expect(await host.readLine().catch((error: unknown) => error)).toBe(failure);
    expect(rawModes).toEqual([true, false]);
    for (const event of ['data', 'end', 'error', 'close', 'keypress']) {
      expect(input.listenerCount(event)).toBe(0);
    }
    expect(input.destroyed).toBe(false);
  } finally {
    host.close();
    input.destroy();
    output.destroy();
  }
}, 1000);

it('waits for line handlers before allowing a source resume callback to supply input', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const host = new TerminalHost({input, output});
  const resume = input.resume.bind(input);
  let supplied = false;
  input.resume = () => {
    if (!supplied) {
      supplied = true;
      input.emit('data', Buffer.from('during resume\n'));
    }
    return resume();
  };
  try {
    expect(await host.readLine()).toBe('during resume');
    host.close();
    expect(input.listenerCount('data')).toBe(0);
    expect(input.destroyed).toBe(false);
  } finally {
    host.close();
    input.destroy();
    output.destroy();
  }
}, 1000);

it('releases owned input and output callbacks when activating input flow throws', async () => {
  const failure = new Error('source resume failed');
  const rawModes: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode(enabled: boolean) {
      rawModes.push(enabled);
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const externalResize = jest.fn();
  output.on('resize', externalResize);
  input.resume = () => {
    // Exercise failure only after a resize forwarder has been acquired.
    expect(output.listenerCount('resize')).toBe(2);
    throw failure;
  };
  const host = new TerminalHost({input, output});
  try {
    expect(await host.readLine().catch((error: unknown) => error)).toBe(failure);
    host.close();
    expect(rawModes).toEqual([true, false]);
    expect(output.listeners('resize')).toEqual([externalResize]);
    for (const event of ['data', 'end', 'error', 'close', 'keypress']) {
      expect(input.listenerCount(event)).toBe(0);
    }
    expect(input.destroyed).toBe(false);
    expect(output.destroyed).toBe(false);
  } finally {
    host.close();
    input.destroy();
    output.destroy();
  }
}, 1000);

for (const failureMode of ['none', 'throw', 'emit'] as const) {
  it(`preserves a caller's pre-existing raw mode when setup outcome is ${failureMode}`, async () => {
    const failure = new Error('raw setup failed');
    const rawModes: boolean[] = [];
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      isRaw: true,
      setRawMode(enabled: boolean) {
        rawModes.push(enabled);
        input.isRaw = enabled;
        if (rawModes.length === 1 && failureMode !== 'none') {
          // Even a partially failed setup must restore the caller's prior mode.
          input.isRaw = false;
          if (failureMode === 'throw') throw failure;
          input.emit('error', failure);
        }
        return input;
      },
    });
    const output = Object.assign(new PassThrough(), {isTTY: true});
    const host = new TerminalHost({input, output});
    try {
      const result = host.readLine().catch((error: unknown) => error);
      if (failureMode === 'none') host.close();
      expect(await result).toBe(failureMode === 'none' ? null : failure);
      host.close();
      expect(input.isRaw).toBe(true);
      expect(rawModes).toEqual(failureMode === 'throw' ? [true, true] : [true, false, true]);
      for (const event of ['data', 'end', 'error', 'close', 'keypress']) {
        expect(input.listenerCount(event)).toBe(0);
      }
    } finally {
      host.close();
      input.destroy();
      output.destroy();
    }
  }, 1000);
}

it('exposes live raw-mode state through the private input stream', () => {
  const source = Object.assign(new PassThrough(), {
    isRaw: false,
    setRawMode(enabled: boolean) {
      source.isRaw = enabled;
      return source;
    },
  });
  const input = new ReadlineInput(source, () => {});
  try {
    expect(input.isRaw).toBe(false);
    input.setRawMode(true);
    expect(input.isRaw).toBe(true);
    input.release();
    expect(input.isRaw).toBe(false);
  } finally {
    input.release();
    source.destroy();
  }
});
