import {afterEach, beforeEach, describe, expect, it, jest} from 'bun:test';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHost} from '../core/host.ts';
import {encodeSourceDocument} from '../core/source_document.ts';
import {runCli, runFile, type CliHost} from './run_cli.ts';

async function rejection<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected rejection');
}

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Expected event did not occur');
}

describe('portable CLI files', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'basic-portable-'));
  });

  afterEach(() => {
    rmSync(directory, {recursive: true, force: true});
  });

  it('runs exact embedded CRLF source in label order without modifying the document', async () => {
    const file = join(directory, 'program.basic.json');
    const source = '30 END\r\n10 PRINT "portable"\r\n20 PRINT "document"\r\n';
    const serialized = encodeSourceDocument(source, {dialect: 'native'});
    writeFileSync(file, serialized);
    const output: string[] = [];
    expect((await runFile(file, {write: (text) => output.push(text)})).status).toBe('halted');
    expect(output).toEqual(['portable\n', 'document\n']);
    expect(readFileSync(file, 'utf8')).toBe(serialized);
  });

  it('reports BASIC coordinates inside source, independent of JSON indentation', async () => {
    const file = join(directory, 'coordinates.basic.json');
    writeFileSync(
      file,
      JSON.stringify(
        {
          format: 'basic-program',
          version: 1,
          dialect: 'native',
          source: '10 REM first\r\n20 PRINT "unfinished',
        },
        null,
        8,
      ),
    );
    const error = await rejection(runFile(file, {}));
    expect(error).toMatchObject({diagnostic: {line: 2, column: 10, label: 20}});
  });

  it.each([
    '{',
    '10 PRINT "not an envelope"',
    JSON.stringify({
      format: 'basic-program',
      version: 1,
      dialect: 'basic-plus-1972-10',
      source: '10 PRINT RND()',
    }),
    JSON.stringify({format: 'basic-program', version: 2, dialect: 'native', source: '10 END'}),
    JSON.stringify({format: 'basic-program', version: 1, source: '10 END'}),
  ])('rejects malformed or unsupported documents before BASIC effects: %s', async (contents) => {
    const file = join(directory, 'invalid.basic.json');
    writeFileSync(file, contents);
    const write = jest.fn();
    const readLine = jest.fn(() => Promise.resolve('should not read'));
    expect(await rejection(runFile(file, {write, readLine}))).toBeInstanceOf(Error);
    expect(write).not.toHaveBeenCalled();
    expect(readLine).not.toHaveBeenCalled();
  });

  it('validates all embedded BASIC before executing an earlier statement', async () => {
    const file = join(directory, 'unreachable.basic.json');
    writeFileSync(file, encodeSourceDocument('10 PRINT "must not print"\n20 END\n30 GOTO 999'));
    const write = jest.fn();
    expect(await rejection(runFile(file, {write}))).toMatchObject({
      diagnostic: {label: 30},
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps other filenames plain source and never sniffs JSON', async () => {
    const file = join(directory, 'looks-like-json.bas');
    writeFileSync(file, encodeSourceDocument('10 PRINT "must not run"'));
    const write = jest.fn();
    expect(await rejection(runFile(file, {write}))).toMatchObject({diagnostic: {line: 1}});
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps simultaneous plain and document runs isolated and resets on rerun', async () => {
    const plain = join(directory, 'plain.bas');
    const portable = join(directory, 'portable.basic.json');
    writeFileSync(plain, '10 N=1:PRINT N');
    writeFileSync(portable, encodeSourceDocument('10 N=2:PRINT N'));
    const output: string[] = [];
    const host = {write: (text: string) => output.push(text)};
    await Promise.all([runFile(plain, host), runFile(portable, host)]);
    await runFile(portable, host);
    expect(output.sort()).toEqual(['1\n', '2\n', '2\n']);
  });

  it('cancels pending document input even if the provider ignores the signal', async () => {
    const file = join(directory, 'waiting.basic.json');
    writeFileSync(file, encodeSourceDocument('10 INPUT N\n20 PRINT N'));
    const controller = new AbortController();
    const readLine = jest.fn(() => new Promise<string>(() => {}));
    const pending = runFile(file, {readLine}, {signal: controller.signal});
    await until(() => readLine.mock.calls.length === 1);
    controller.abort();
    expect(await rejection(pending)).toMatchObject({name: 'AbortError'});
    expect(readLine).toHaveBeenCalledTimes(1);
  });

  it('returns CLI failure and disposes the host on unsupported metadata', async () => {
    const file = join(directory, 'unsupported.basic.json');
    writeFileSync(
      file,
      JSON.stringify({
        format: 'basic-program',
        version: 1,
        dialect: 'basic-plus-1972-10',
        source: '10 END',
      }),
    );
    const errors: string[] = [];
    const close = jest.fn();
    const host: CliHost = {
      ...createHost(),
      writeError: (text) => errors.push(text),
      discardEntry: jest.fn(),
      setInterruptHandler: jest.fn(),
      close,
    };
    expect(await runCli([file], {host})).toBe(1);
    expect(errors.join('')).toMatch(/dialect/);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
