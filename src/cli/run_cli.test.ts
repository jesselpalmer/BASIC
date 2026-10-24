import {once} from 'node:events';
import {describe, it, expect, beforeEach, afterEach} from 'bun:test';
import {jest} from 'bun:test';
import {PassThrough} from 'node:stream';
import {mkdtempSync, promises as fs, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
      ['10 PRINT "one"', '20 END', '10 PRINT INT("bad")', '10 PRINT "two"', '20 END', ''].join(
        '\n',
      ),
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
});
