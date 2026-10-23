import {PassThrough} from 'stream';
import {mkdtempSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import {runCli, runFile} from './run_cli';
import TerminalHost from './terminal_host';

describe('CLI adapter lifecycle', () => {
  let directory;
  let input;
  let output;
  let errors;
  let host;
  let originalSignals;

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
    expect(await runCli([file], {host})).toBe(0);
    expect(output.read().toString()).toBe('file\n');
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
    expect(errors.read().toString()).toContain('ENOENT');
  });

  it('reports invalid arguments without starting a terminal', async () => {
    expect(await runCli(['one', 'two'], {host})).toBe(9);
    expect(errors.read().toString()).toContain('Usage:');
  });

  it('handles EOF while waiting at the prompt', async () => {
    const result = runCli([], {host});
    input.end();
    expect(await result).toBe(0);
    expect(output.read().toString()).toContain('Have a great day');
  });

  it('allows another run after END and an error', async () => {
    const result = runCli([], {host});
    input.end([
      '10 PRINT "one"', '20 END',
      '10 INT "bad"', '10 PRINT "two"', '20 END', '',
    ].join('\n'));
    expect(await result).toBe(0);
    const text = output.read().toString();
    expect(text).toContain('one\n');
    expect(text).toContain('two\n');
    expect(errors.read().toString()).toContain('Invalid number');
  });

  it('reports an input stream failure and releases its listeners', async () => {
    const result = runCli([], {host});
    input.emit('error', new Error('input failed'));
    expect(await result).toBe(1);
    expect(errors.read().toString()).toContain('input failed');
  });
});
