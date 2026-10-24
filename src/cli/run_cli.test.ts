import {once} from 'node:events';
import {describe, it, expect, beforeEach, afterEach} from 'bun:test';
import {jest} from 'bun:test';
import {PassThrough} from 'node:stream';
import {mkdtempSync, promises as fs, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runCli, runFile} from './run_cli.ts';
import TerminalHost from './terminal_host.ts';

function readAll(stream: PassThrough): string {
  const chunks: Buffer[] = [];
  for (;;) {
    const chunk: unknown = stream.read();
    if (chunk === null) break;
    if (!Buffer.isBuffer(chunk)) throw new Error('Expected binary stream output');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

it('routes TTY Ctrl+C through the owned interrupt handler', async () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode() {
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const errors = new PassThrough();
  const host = new TerminalHost({input, output, errorOutput: errors});
  const signals = process.listeners('SIGINT');
  try {
    const result = runCli([], {host});
    input.write('10 PRINT "discarded partial"');
    input.write('\u001b[D\u001b[D\u001b[D');
    input.write('\u0003');
    input.end('EXIT\n');
    expect(await result).toBe(0);
    expect(errors.read()).toBeNull();
    expect(process.listeners('SIGINT')).toEqual(signals);
    expect(input.listenerCount('keypress')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
    // node:readline intentionally leaves shared keypress decoding on a TTY
    // after close; only adapter/interface-owned listeners must be removed.
  } finally {
    host.close();
    input.destroy();
    output.destroy();
    errors.destroy();
  }
});

describe('CLI adapter lifecycle', () => {
  let directory: string;
  let input: PassThrough;
  let output: PassThrough;
  let errors: PassThrough;
  let host: TerminalHost;
  let originalSignals: ReturnType<typeof process.listeners>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'basic-cli-'));
    input = new PassThrough();
    output = new PassThrough();
    errors = new PassThrough();
    host = new TerminalHost({input, output, errorOutput: errors});
    originalSignals = process.listeners('SIGINT');
  });

  afterEach(() => {
    expect(process.listeners('SIGINT')).toEqual(originalSignals);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    host.close();
    input.destroy();
    output.destroy();
    errors.destroy();
    rmSync(directory, {recursive: true, force: true});
  });

  it('runs a file without opening terminal input', async () => {
    const file = join(directory, 'program.bas');
    writeFileSync(file, '10 PRINT "file"\n20 END\n30 PRINT "skipped"');
    const read = jest.spyOn(fs, 'readFile');
    try {
      expect(await runCli([file], {host})).toBe(0);
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith(
        file,
        expect.objectContaining({
          encoding: 'utf8',
        }),
      );
    } finally {
      read.mockRestore();
    }
    expect(readAll(output)).toBe('file\n');
    expect(errors.read()).toBeNull();
  });

  it('routes process SIGINT to a pending file program and returns 130', async () => {
    const file = join(directory, 'waiting.bas');
    writeFileSync(file, '10 INPUT "Answer"; N');
    const prompted = once(output, 'data');
    const result = runCli([file], {host});
    await prompted;
    process.emit('SIGINT');
    expect(await result).toBe(130);
    expect(errors.read()).toBeNull();
  });

  it('keeps simultaneous file runs isolated', async () => {
    const one = join(directory, 'one.bas');
    const two = join(directory, 'two.bas');
    writeFileSync(one, '10 PRINT "one"');
    writeFileSync(two, '10 PRINT "two"');
    const write = jest.fn();
    await Promise.all([runFile(one, {write}), runFile(two, {write})]);
    expect(write).toHaveBeenCalledWith('one\n');
    expect(write).toHaveBeenCalledWith('two\n');
  });

  it('reports an unreadable file and closes cleanly', async () => {
    expect(await runCli([join(directory, 'missing.bas')], {host})).toBe(1);
    expect(readAll(errors)).toContain('ENOENT');
  });

  it('reports invalid arguments without starting a terminal', async () => {
    expect(await runCli(['one', 'two'], {host})).toBe(9);
    expect(readAll(errors)).toContain('Usage:');
  });

  it('discards a partial piped entry on process SIGINT before the next command', async () => {
    const result = runCli([], {host});
    input.write('10 PRINT "must never be stored"');
    process.emit('SIGINT');
    input.end('EXIT\n');
    expect(await result).toBe(0);
    expect(readAll(errors)).toBe('');
    expect(readAll(output)).not.toContain('must never be stored');
  });

  it('handles EOF while waiting at the prompt', async () => {
    const result = runCli([], {host});
    input.end();
    expect(await result).toBe(0);
    expect(readAll(output)).toContain('Have a great day');
  });

  it('completes when injected input already reached EOF', async () => {
    input.resume();
    const ended = once(input, 'end');
    input.end();
    await ended;
    expect(await runCli([], {host})).toBe(0);
    expect(readAll(output)).toContain('Have a great day');
    expect(errors.read()).toBeNull();
    expect(input.listenerCount('close')).toBe(0);
  });

  it('allows another run after END and an error', async () => {
    const result = runCli([], {host});
    input.end(
      [
        '10 PRINT "one"',
        '20 END',
        'RUN',
        '10 PRINT INT("bad")',
        'RUN',
        '10 PRINT "two"',
        'RUN',
        'EXIT',
        'yes',
      ].join('\n') + '\n',
    );
    expect(await result).toBe(0);
    const text = readAll(output);
    expect(text).toContain('one\n');
    expect(text).toContain('two\n');
    expect(readAll(errors)).toContain('Line 10, column 10: Expected a number');
  });

  it('reports an input stream failure and releases its listeners', async () => {
    const result = runCli([], {host});
    input.emit('error', new Error('input failed'));
    expect(await result).toBe(1);
    expect(readAll(errors)).toContain('input failed');
  });

  it('runs file input, retries numeric values, and closes all terminal listeners', async () => {
    const file = join(directory, 'input.bas');
    writeFileSync(file, '10 INPUT "Name"; N$\n20 INPUT "Age"; A\n30 PRINT N$;":";A');
    input.end('Jesse\n12oops\n42\n');
    expect(await runCli([file], {host})).toBe(0);
    expect(readAll(output)).toBe(
      'Name? Age? Invalid number; please enter a finite decimal.\nAge? Jesse:42\n',
    );
    expect(errors.read()).toBeNull();
  });

  it('runs the guessing game with deterministic randomness and piped answers', async () => {
    host.random = () => 0.41;
    input.end('20\n80\n42\n');
    expect(await runCli([resolve(import.meta.dirname, '../../examples/guess.bas')], {host})).toBe(
      0,
    );
    const prompt = 'Guess a number from 1 to 100? ';
    expect(readAll(output)).toBe(
      `${prompt}Too low.\n${prompt}Too high.\n${prompt}Correct in 3 tries!\n`,
    );
    expect(errors.read()).toBeNull();
  });

  it('consumes input answers before reading another editor entry', async () => {
    const result = runCli([], {host});
    input.end(
      [
        '10 INPUT N$',
        '20 PRINT N$',
        '30 INPUT A',
        '40 PRINT A',
        '50 END',
        'RUN',
        'RUN',
        'bad',
        '.5',
        'EXIT',
        'yes',
        '',
      ].join('\n'),
    );
    expect(await result).toBe(0);
    const text = readAll(output);
    expect(text).toContain('RUN\n');
    expect(text).toContain('Invalid number; please enter a finite decimal.\n');
    expect(text).toContain('0.5\n');
    expect(errors.read()).toBeNull();
  });

  it.each(['file', 'interactive'])(
    'treats EOF during %s input as a located failure',
    async (mode) => {
      const file = join(directory, 'eof.bas');
      writeFileSync(file, '10 INPUT N\n20 PRINT "skipped"');
      const result = runCli(mode === 'file' ? [file] : [], {host});
      input.end(mode === 'file' ? '' : '10 INPUT N\nRUN\n');
      expect(await result).toBe(1);
      expect(readAll(errors)).toBe(
        'Line 10, column 4: Input ended before a value was received\n' +
          (mode === 'file'
            ? ''
            : 'Unsaved program at EOF; copy the source below before closing:\n10 INPUT N\n'),
      );
      expect(readAll(output)).not.toContain('skipped');
    },
  );
});

it('raw TTY Ctrl+C stops a computing program, retains its source, and permits another RUN', async () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode() {
      return input;
    },
  });
  const output = Object.assign(new PassThrough(), {isTTY: true});
  const errors = new PassThrough();
  const host = new TerminalHost({input, output, errorOutput: errors});
  const signals = process.listeners('SIGINT');
  let text = '';
  let phase = 0;
  let cancelTimer: ReturnType<typeof setTimeout> | undefined;
  output.on('data', (chunk: Buffer) => {
    text += chunk.toString();
    if (phase === 0 && text.includes('>>> ')) {
      phase = 1;
      queueMicrotask(() => {
        // A finite loop bounds a failed test even if yielding regresses.
        input.write(
          '10 PRINT "COMPUTING"\n20 FOR I=1 TO 1024\n30 REM spin\n40 NEXT I\n50 PRINT "MISSED_CANCEL"\nRUN\n',
        );
      });
    } else if (phase === 1 && text.includes('COMPUTING\n')) {
      phase = 2;
      // The macrotask must run while BASIC is still computing.
      cancelTimer = setTimeout(() => input.write('\u0003'), 0);
    } else if (phase === 2 && text.slice(text.indexOf('COMPUTING\n')).includes('>>> ')) {
      phase = 3;
      queueMicrotask(() => {
        input.end('LIST\n20\n30\n40\n50\n10 PRINT "AFTER_CANCEL"\nRUN\nEXIT\nyes\n');
      });
    }
  });
  try {
    expect(await runCli([], {host})).toBe(0);
    expect(phase).toBe(3);
    expect(text).toContain(
      '10 PRINT "COMPUTING"\n20 FOR I=1 TO 1024\n30 REM spin\n40 NEXT I\n50 PRINT "MISSED_CANCEL"\n',
    );
    expect(text).not.toContain('MISSED_CANCEL\n');
    expect(text).toContain('AFTER_CANCEL\n');
    expect(errors.read()).toBeNull();
    expect(process.listeners('SIGINT')).toEqual(signals);
    expect(input.listenerCount('keypress')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
  } finally {
    clearTimeout(cancelTimer);
    host.close();
    input.destroy();
    output.destroy();
    errors.destroy();
  }
});
