import {expect, it} from 'bun:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {runProcess} from '../../scripts/subprocess.ts';

const root = resolve(import.meta.dirname, '../..');
const executable = join(root, 'bin/basic');

it('runs a complete BASIC file with piped input and redirected output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'basic-file-statements-'));
  try {
    const file = join(directory, 'sum.bas');
    writeFileSync(
      file,
      [
        '10 REM A comment may contain an unmatched " and keywords like END',
        '20 CLS',
        '30 INPUT "Name"; NAME$',
        '40 INPUT "Count"; COUNT',
        '50 LET TOTAL=0',
        '60 FOR I=1 TO COUNT',
        '70 LET TOTAL=TOTAL+I',
        '80 NEXT I',
        '90 IF TOTAL=6 THEN 120',
        '100 PRINT "wrong total"',
        '110 GOTO 140',
        '120 PRINT NAME$;": ";TOTAL',
        '130 GOTO 150',
        '140 PRINT "must not run"',
        '150 END',
        '160 PRINT "after END"',
      ].join('\n'),
    );
    const result = runProcess({
      cwd: directory,
      args: [executable, file],
      input: 'Ada\n3\n',
    });
    expect(result.stdout).toBe('Name? Count? Ada: 6\n');
    expect(result.stderr).toBe('');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

it('reports a directory read failure without opening the editor', () => {
  // Unlike permission bits, a directory reliably fails even when tests run as root.
  const directory = mkdtempSync(join(tmpdir(), 'basic-file-unreadable-'));
  try {
    const result = runProcess({cwd: root, args: [executable, directory], expectedStatus: 1});
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/EISDIR/);
    expect(result.stderr).not.toMatch(/\n\s+at /);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
