import assert from 'node:assert/strict';
import {existsSync, mkdirSync, realpathSync, writeFileSync} from 'node:fs';
import {delimiter, dirname, join} from 'node:path';
import metadata from '../../package.json' with {type: 'json'};
import {runProcess, runWithOpenInput} from '../subprocess.ts';
import {checkPersistenceSessions} from './check-persistence.ts';

interface CliContext {
  consumer: string;
  installed: string;
  executable: string;
  file: string;
}

function checkFileExecution({consumer, installed, executable, file}: CliContext): void {
  writeFileSync(
    file,
    '30 END\n20 PRINT "CLI "; NAME$\n10 LET NAME$ = "works"\n40 PRINT "unreachable"',
  );
  const executed = runProcess({cwd: consumer, args: [executable, file]});
  assert.equal(executed.stdout, 'CLI works\n');
  assert.equal(executed.stderr, '');
  if (process.platform !== 'win32') {
    const direct = runProcess({command: executable, cwd: consumer, args: [file]});
    assert.equal(direct.stdout, 'CLI works\n');
    assert.equal(direct.stderr, '');
  }
  writeFileSync(file, '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$');
  const input = runProcess({cwd: consumer, args: [executable, file], input: 'Jesse\n'});
  assert.equal(input.stdout, 'Name? Hello, Jesse\n');
  assert.equal(input.stderr, '');
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
  const statements = runProcess({
    cwd: consumer,
    args: [executable, file],
    input: 'Ada\n3\n',
  });
  assert.equal(statements.stdout, 'Name? Count? Ada: 6\n');
  assert.equal(statements.stderr, '');
  for (const {example, answer, expected} of [
    {
      example: 'times-table.bas',
      answer: '2\n',
      expected:
        'Which times table? ' +
        Array.from({length: 10}, (_, i) => `${i + 1} x 2 = ${(i + 1) * 2}\n`).join(''),
    },
    {
      example: 'greeting.bas',
      answer: '  Ada LoveLace  \n',
      expected: 'What is your name? Hello,   Ada LoveLace  !\n',
    },
  ]) {
    const result = runProcess({
      cwd: consumer,
      args: [executable, join(installed, 'examples', example)],
      input: answer,
    });
    assert.equal(result.stdout, expected, example);
    assert.equal(result.stderr, '');
  }
}

async function checkOpenInputAndInterrupts({
  consumer,
  executable,
  file,
}: CliContext): Promise<void> {
  writeFileSync(file, '10 PRINT "CLI works"');
  assert.deepEqual(await runWithOpenInput({cwd: consumer, args: [executable, file]}), {
    status: 0,
    signal: null,
    stdout: 'CLI works\n',
    stderr: '',
  });
  if (process.platform === 'win32') return;
  for (const {source, marker} of [
    {source: '10 INPUT "Answer"; N\n20 PRINT "skipped"', marker: 'Answer? '},
    {source: '10 PRINT "started"\n20 GOTO 20\n40 PRINT "must not finish"', marker: 'started\n'},
    {
      source: '10 PRINT "started"\n20 FOR I=1 TO 1000000000\n30 NEXT I\n40 PRINT "must not finish"',
      marker: 'started\n',
    },
  ]) {
    writeFileSync(file, source);
    const cancelled = await runWithOpenInput({
      cwd: consumer,
      args: [executable, file],
      interruptAt: marker,
    });
    assert.deepEqual(cancelled, {status: 130, signal: null, stdout: marker, stderr: ''}, source);
  }
}

function checkFileFailures({consumer, executable, file}: CliContext): void {
  const missing = runProcess({
    cwd: consumer,
    args: [executable, join(consumer, 'missing.bas')],
    expectedStatus: 1,
  });
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /ENOENT/);
  assert.doesNotMatch(missing.stderr, /\n\s+at /);
  const unreadable = runProcess({
    cwd: consumer,
    args: [executable, consumer],
    expectedStatus: 1,
  });
  assert.equal(unreadable.stdout, '');
  assert.match(unreadable.stderr, /EISDIR/);
  assert.doesNotMatch(unreadable.stderr, /\n\s+at /);
  const usage = runProcess({
    cwd: consumer,
    args: [executable, 'one.bas', 'two.bas'],
    expectedStatus: 9,
  });
  assert.equal(usage.stdout, '');
  assert.match(usage.stderr, /Usage:/);
  for (const {source, stdout, stderr} of [
    {
      source: '10 PRINT "must not run"\n20 PRINT "unfinished',
      stdout: '',
      stderr: 'Line 20, column 10: Unterminated string\n',
    },
    {
      source: '10 PRINT 1/0\n20 PRINT "skipped"',
      stdout: '',
      stderr: 'Line 10, column 11: Cannot divide by zero\n',
    },
    {
      source: '10 INPUT "Answer"; N\n20 PRINT "skipped"',
      stdout: 'Answer? ',
      stderr: 'Line 10, column 4: Input ended before a value was received\n',
    },
  ]) {
    writeFileSync(file, source);
    const failure = runProcess({cwd: consumer, args: [executable, file], expectedStatus: 1});
    assert.equal(failure.stdout, stdout, source);
    assert.equal(failure.stderr, stderr, source);
  }
}

function checkEditorSession({consumer, executable}: CliContext): void {
  const interactive = runProcess({cwd: consumer, args: [executable]});
  assert.equal(interactive.stdout.split('\n')[0], `BASIC ${metadata.version}`);
  assert.equal(interactive.stderr, '');
  const listedSource = '10 GOTO 30\n30 INPUT "Name"; N$\n40 PRINT "Hello, ";N$\n';
  const editor = runProcess({
    cwd: consumer,
    args: [executable],
    input: [
      '30 INPUT "Name"; N$',
      '40 PRINT "Hello, ";N$',
      '10 GOTO 30',
      '20 PRINT "deleted"',
      '20',
      'LIST',
      'RUN',
      'EXIT', // Program INPUT owns this text; it must not close the editor.
      'RUN',
      'Ada',
      'NEW',
      'no',
      'LIST',
      'EXIT',
      'yes',
      '',
    ].join('\n'),
  });
  assert.equal(editor.stderr, '');
  assert.equal(editor.stdout.split(listedSource).length - 1, 2);
  assert.ok(editor.stdout.includes('Hello, EXIT\n'));
  assert.ok(editor.stdout.includes('Hello, Ada\n'));
  assert.ok(!editor.stdout.includes('deleted'));
}

function checkEditorRecovery({consumer, executable}: CliContext): void {
  const recovered = runProcess({
    cwd: consumer,
    args: [executable],
    input: '30 PRINT "last"\n10 PRINT "first"\nRUN\n',
    expectedStatus: 1,
  });
  assert.equal(
    recovered.stderr,
    'Unsaved program at EOF; copy the source below before closing:\n10 PRINT "first"\n30 PRINT "last"\n',
  );
  assert.ok(recovered.stdout.includes('first\nlast\n'));
  for (const {input, output, error} of [
    {
      input: '10 PRINT "kept"\n10 PRINT "unfinished\nRUN\nEXIT\nyes\n',
      output: 'kept\n',
      error: 'Line 10, column 10: Unterminated string\n',
    },
    {
      input: '10 GOTO 30\nRUN\n30 PRINT "fixed"\nRUN\nEXIT\nyes\n',
      output: 'fixed\n',
      error: 'Line 10, column 9: No line label 30\n',
    },
  ]) {
    const result = runProcess({cwd: consumer, args: [executable], input});
    assert.equal(result.stderr, error);
    assert.ok(result.stdout.includes(output), input);
  }
  const cleared = runProcess({
    cwd: consumer,
    args: [executable],
    input: '10 PRINT "discarded"\nNEW\nyes\nRUN\nLIST\nEXIT\n',
  });
  assert.equal(cleared.stderr, '');
  assert.ok(!cleared.stdout.includes('discarded'));
}

async function checkEditorInterrupts({consumer, executable}: CliContext): Promise<void> {
  if (process.platform === 'win32') return;
  for (const [source, marker] of [
    ['10 PRINT "started"\n20 GOTO 20', 'started\n'],
    ['10 INPUT "Answer"; N$\n20 PRINT N$', 'Answer? '],
  ]) {
    let phase: 'starting' | 'running' | 'interrupted' | 'recovered' = 'starting';
    let promptsAtInterrupt = 0;
    const interrupted = await runWithOpenInput({
      cwd: consumer,
      args: [executable],
      onOutput(stdout, child) {
        const prompts = stdout.split('>>> ').length - 1;
        if (phase === 'starting' && prompts > 0) {
          phase = 'running';
          child.stdin.write(source + '\nRUN\n');
        }
        if (phase === 'running' && stdout.includes(marker)) {
          phase = 'interrupted';
          promptsAtInterrupt = prompts;
          child.kill('SIGINT');
        }
        if (phase === 'interrupted' && prompts > promptsAtInterrupt) {
          phase = 'recovered';
          child.stdin.write('LIST\nNEW\nyes\n10 PRINT "recovered"\nRUN\nEXIT\nyes\n');
        }
      },
    });
    assert.equal(phase, 'recovered', 'Interrupted editor never returned to its prompt');
    assert.equal(interrupted.status, 0);
    assert.equal(interrupted.signal, null);
    assert.equal(interrupted.stderr, '');
    assert.ok(interrupted.stdout.includes(source + '\n'));
    assert.ok(interrupted.stdout.includes('recovered\n'));
  }
}

export async function checkLocalCli(consumer: string, installed: string): Promise<void> {
  const shim = join(
    consumer,
    'node_modules/.bin',
    process.platform === 'win32' ? 'basic.cmd' : 'basic',
  );
  assert.ok(existsSync(shim), 'Bun must install the basic executable');
  const executable = process.platform === 'win32' ? join(installed, 'bin/basic') : shim;
  const context = {consumer, installed, executable, file: join(consumer, 'sample.bas')};
  checkFileExecution(context);
  checkFileFailures(context);
  await checkOpenInputAndInterrupts(context);
  checkEditorSession(context);
  checkEditorRecovery(context);
  await checkEditorInterrupts(context);
  await checkPersistenceSessions(executable);
}

export function checkGlobalCli(directory: string, archive: string): void {
  if (process.platform === 'win32') return;
  // Discover the command through PATH without touching the real global install.
  const globalDirectory = join(directory, 'global');
  const globalBin = join(directory, 'global-bin');
  const unrelated = join(directory, 'unrelated');
  mkdirSync(unrelated);
  const env = {
    ...process.env,
    BUN_INSTALL_GLOBAL_DIR: globalDirectory,
    BUN_INSTALL_BIN: globalBin,
    PATH: [globalBin, dirname(process.execPath), process.env.PATH ?? ''].join(delimiter),
  };
  runProcess({
    cwd: unrelated,
    args: ['install', '--global', '--ignore-scripts', archive],
    env,
    timeout: 60000,
  });
  assert.equal(
    realpathSync(join(globalBin, 'basic')),
    realpathSync(join(globalDirectory, 'node_modules/node-basic-lang/bin/basic')),
  );
  const file = join(unrelated, 'sample.bas');
  writeFileSync(file, '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$');
  const input = runProcess({command: 'basic', args: [file], cwd: unrelated, input: 'Ada\n', env});
  assert.equal(input.stdout, 'Name? Hello, Ada\n');
  assert.equal(input.stderr, '');
  writeFileSync(file, '10 PRINT 1/0');
  const error = runProcess({
    command: 'basic',
    args: [file],
    cwd: unrelated,
    expectedStatus: 1,
    env,
  });
  assert.equal(error.stdout, '');
  assert.equal(error.stderr, 'Line 10, column 11: Cannot divide by zero\n');
}
