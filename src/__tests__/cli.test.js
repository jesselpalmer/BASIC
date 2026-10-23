import {spawnSync} from 'child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join, resolve} from 'path';

const root = resolve(__dirname, '../..');
const executable = join(root, 'bin/basic');

function run(args, input = '') {
  const result = spawnSync(process.execPath, [executable, ...args], {
    encoding: 'utf8',
    input,
    timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return result.stdout;
}

describe('checked-in CLI baseline', () => {
  it('executes the current README sample', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const sample = readme.match(/```bas\n([\s\S]*?)```/)[1];
    const directory = mkdtempSync(join(tmpdir(), 'basic-readme-'));
    try {
      const file = join(directory, 'sample.bas');
      writeFileSync(file, sample);
      const output = run([file]);
      expect(output).toContain('HELLO WORLD\n');
      expect(output).toContain('HELLO WORLD 2X\n');
      expect(output).toContain('HELLO WORLD 3X\n');
      expect(output).toContain('3.14\n1\n');
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('rejects duplicate file lines and floors negative decimals', () => {
    const file = join(__dirname, 'fixtures/duplicate-lines.bas');
    const output = run([file]);
    expect(output).toContain('FIRST UNIQUE OUTPUT\n');
    expect(output).toContain('SECOND UNIQUE OUTPUT\n');
    expect(output).toContain('INVALID: Line number has been used 10');
    expect(output.split(/\r?\n/)).not.toContain('DUPLICATE MUST NOT EXECUTE');
    expect(output).toContain('-2\n');
    expect(run([file])).toBe(output);
  });

  it('uses one validation history throughout a REPL session', () => {
    const output = run([], [
      '10 PRINT "FIRST UNIQUE OUTPUT"',
      '10 PRINT "DUPLICATE MUST NOT EXECUTE"',
      '20 INT "-1.6"',
      '',
    ].join('\n'));
    expect(output).toContain('FIRST UNIQUE OUTPUT');
    expect(output).toContain('INVALID: Line number has been used 10');
    expect(output).not.toMatch(/>>> DUPLICATE MUST NOT EXECUTE/);
    expect(output).toContain('-2');
  });
});
