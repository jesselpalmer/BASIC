import {spawn, spawnSync} from 'child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join, resolve} from 'path';

const root = resolve(__dirname, '../..');
const executable = join(root, 'bin/basic');

function run(args, input = '', status = 0) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    encoding: 'utf8', input, timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(status);
  return result;
}

// Leave stdin open: a leaked readline interface would prevent child exit.
function runWithOpenInput(args, onOutput = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd: root});
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Child did not exit with stdin still open'));
    }, 5000);
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      onOutput(stdout, child);
    });
    child.stderr.on('data', (data) => {
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

describe('built CLI and core lifecycle', () => {
  it('executes the current README sample', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const sample = readme.match(/```bas\n([\s\S]*?)```/)[1];
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
    const file = join(__dirname, 'fixtures/duplicate-lines.bas');
    const {stdout, stderr} = run([file], '', 1);
    expect(stdout).toContain('FIRST UNIQUE OUTPUT\n');
    expect(stdout).toContain('SECOND UNIQUE OUTPUT\n');
    expect(stderr).toContain('INVALID: Line number has been used 10');
    expect(stdout).not.toContain('DUPLICATE MUST NOT EXECUTE');
    expect(run([file], '', 1).stdout).toBe(stdout);
  });

  it('reports REPL duplicates and keeps the prompt usable', () => {
    const {stdout, stderr} = run([], [
      '10 PRINT "FIRST UNIQUE OUTPUT"',
      '10 PRINT "DUPLICATE MUST NOT EXECUTE"',
      '20 INT "-1.6"', '',
    ].join('\n'));
    expect(stdout).toContain('FIRST UNIQUE OUTPUT');
    expect(stderr).toContain('INVALID: Line number has been used 10');
    expect(stdout).not.toContain('DUPLICATE MUST NOT EXECUTE');
    expect(stdout).toContain('-2');
  });

  it('continues the interactive session after END', () => {
    const {stdout, stderr} = run([], [
      '10 PRINT "first run"', '20 END',
      '10 PRINT "second run"', '20 END', '',
    ].join('\n'));
    expect(stderr).toBe('');
    expect(stdout).toContain('first run\n');
    expect(stdout).toContain('second run\n');
  });

  it('imports the core and constructs interpreters without side effects',
      async () => {
        const result = await runWithOpenInput([
          '-e', 'const {Basic} = require("."); new Basic(); new Basic();',
        ]);
        expect(result).toEqual({
          status: 0, signal: null, stdout: '', stderr: '',
        });
      });

  it('file mode finishes naturally with stdin still open', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'basic-open-input-'));
    try {
      const file = join(directory, 'program.bas');
      writeFileSync(file, '10 PRINT "done"');
      expect(await runWithOpenInput([executable, file])).toEqual({
        status: 0, signal: null, stdout: 'done\n', stderr: '',
      });
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('reports missing files without an unhandled exception', async () => {
    const result = await runWithOpenInput([
      executable, join(__dirname, 'fixtures/missing.bas'),
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
