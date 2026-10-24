import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {describe, it, expect} from 'bun:test';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import metadata from '../../package.json' with {type: 'json'};

const root = resolve(import.meta.dirname, '../..');
const executable = join(root, 'bin/basic');

function run(args: string[], input = '', status = 0) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    encoding: 'utf8',
    input,
    timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(status);
  return result;
}

// Leave stdin open: a leaked readline interface would prevent child exit.
function runWithOpenInput(
  args: string[],
  onOutput: (text: string, child: ChildProcessWithoutNullStreams) => void = () => {},
) {
  return new Promise<{
    status: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd: root});
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Child did not exit with stdin still open'));
    }, 5000);
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      onOutput(stdout, child);
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (status, signal) => {
      clearTimeout(timeout);
      child.stdin.destroy();
      resolve({status, signal, stdout, stderr});
    });
  });
}

describe('CLI and core lifecycle', () => {
  it('shows the version from package metadata', () => {
    expect(run([]).stdout.split('\n')[0]).toBe(`BASIC ${metadata.version}`);
  });

  it('executes the current README sample', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const sample = readme.match(/```bas\n([\s\S]*?)```/)![1];
    const directory = mkdtempSync(join(tmpdir(), 'basic-readme-'));
    try {
      const file = join(directory, 'sample.bas');
      writeFileSync(file, sample);
      const {stdout, stderr} = run([file]);
      expect(stderr).toBe('');
      expect(stdout).toContain('HELLO WORLD\n');
      expect(stdout).toContain('HELLO WORLD 2X\n');
      expect(stdout).toContain('HELLO WORLD 3X\n');
      expect(stdout).toContain('3.14\n1\n');
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('reports duplicate file lines and exits without executing them', () => {
    const file = join(import.meta.dirname, 'fixtures/duplicate-lines.bas');
    const {stdout, stderr} = run([file], '', 1);
    expect(stdout).toContain('FIRST UNIQUE OUTPUT\n');
    expect(stdout).toContain('SECOND UNIQUE OUTPUT\n');
    expect(stderr).toContain('Line 10, column 1: Duplicate line label 10');
    expect(stdout).not.toContain('DUPLICATE MUST NOT EXECUTE');
    expect(run([file], '', 1).stdout).toBe(stdout);
  });

  it('reports REPL duplicates and keeps the prompt usable', () => {
    const {stdout, stderr} = run(
      [],
      [
        '10 PRINT "FIRST UNIQUE OUTPUT"',
        '10 PRINT "DUPLICATE MUST NOT EXECUTE"',
        '20 INT "-1.6"',
        '',
      ].join('\n'),
    );
    expect(stdout).toContain('FIRST UNIQUE OUTPUT');
    expect(stderr).toContain('Line 10, column 1: Duplicate line label 10');
    expect(stdout).not.toContain('DUPLICATE MUST NOT EXECUTE');
    expect(stdout).toContain('-2');
  });

  it('executes tokenized input and recovers after a lexical error', () => {
    const {stdout, stderr} = run(
      [],
      ['\t10\tprint "Hello ""World"""', '20 print "unfinished', '10 print "recovered"', ''].join(
        '\n',
      ),
    );
    expect(stdout).toContain('Hello "World"\n');
    expect(stdout).toContain('recovered\n');
    expect(stderr).toBe('Line 20, column 10: Unterminated string\n');
  });

  it('reports a file lexical error with its physical location and exits 1', () => {
    const directory = mkdtempSync(join(tmpdir(), 'basic-lexical-'));
    try {
      const file = join(directory, 'invalid.bas');
      writeFileSync(file, '\r\n\t10abc PRINT "must not run"');
      const {stdout, stderr} = run([file], '', 1);
      expect(stdout).toBe('');
      expect(stderr).toContain('Source line 2, column 2: Invalid line label "10abc"');
      expect(stderr).not.toContain(' at ');
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('continues the interactive session after END', () => {
    const {stdout, stderr} = run(
      [],
      ['10 PRINT "first run"', '20 END', '10 PRINT "second run"', '20 END', ''].join('\n'),
    );
    expect(stderr).toBe('');
    expect(stdout).toContain('first run\n');
    expect(stdout).toContain('second run\n');
  });

  it.each([
    ['CommonJS', ['-e', 'const {Basic} = require("node-basic-lang"); new Basic(); new Basic();']],
    [
      'ES modules',
      [
        '--input-type=module',
        '-e',
        'import {Basic} from "node-basic-lang"; new Basic(); new Basic();',
      ],
    ],
  ])('imports with %s and constructs interpreters quietly', async (_format, args) => {
    const result = await runWithOpenInput(args);
    expect(result).toEqual({
      status: 0,
      signal: null,
      stdout: '',
      stderr: '',
    });
  });

  it('file mode finishes naturally with stdin still open', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'basic-open-input-'));
    try {
      const file = join(directory, 'program.bas');
      writeFileSync(file, '10 PRINT "done"');
      expect(await runWithOpenInput([executable, file])).toEqual({
        status: 0,
        signal: null,
        stdout: 'done\n',
        stderr: '',
      });
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('reports missing files without an unhandled exception', async () => {
    const result = await runWithOpenInput([
      executable,
      join(import.meta.dirname, 'fixtures/missing.bas'),
    ]);
    expect(result.status).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('ENOENT');
    expect(result.stderr).not.toContain(' at ');
  });

  it('closes a waiting terminal cleanly on SIGINT', async () => {
    let interrupted = false;
    const result = await runWithOpenInput([executable], (text, child) => {
      if (!interrupted && text.includes('>>> ')) {
        interrupted = true;
        child.kill('SIGINT');
      }
    });
    expect(result.status).toBe(130);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
  });

  it('exits cleanly on EOF or a blank line', () => {
    expect(run([]).stderr).toBe('');
    const result = run([], '\n10 PRINT "after exit"\n');
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('after exit');
  });
});
