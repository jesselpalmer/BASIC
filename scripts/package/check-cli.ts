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
      '50 TOTAL=0',
      '60 FOR I=1 TO COUNT',
      '70 TOTAL=TOTAL+I',
      '80 NEXT I',
      '90 IF TOTAL=6 THEN 120',
      '100 PRINT "wrong total"',
      '110 GO TO 140',
      '120 PRINT NAME$ ": "TOTAL',
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
  const board = runProcess({
    cwd: consumer,
    args: [executable, join(consumer, 'scripts/package/fixtures/arrays/board.bas')],
    input: '1\n2\n1\n19\n0\n',
  });
  assert.equal(
    board.stdout,
    'pieces:48\nFrom? To? illegal\npieces:48\nFrom? To? pieces:47\nFrom? moves:1\n',
  );
  assert.equal(board.stderr, '');
  const checker = runProcess({
    cwd: consumer,
    args: [executable, join(consumer, 'scripts/package/fixtures/classic/1check-corrected.bas')],
    input: '1\n2\n1\n19\n0\nMAYBE\nYES\n0\nNO\n',
  });
  assert.equal(checker.stderr, '');
  const numberedBlock =
    [
      ' 1  2   3   4   5   6   7   8',
      ' 9 10  11  12  13  14  15  16',
      '17 18  19  20  21  22  23  24',
      '25 26  27  28  29  30  31  32',
      '33 34  35  36  37  38  39  40',
      '41 42  43  44  45  46  47  48',
      '49 50  51  52  53  54  55  56',
      '57 58  59  60  61  62  63  64',
    ].join('\n') + '\n';
  assert.equal(checker.stdout.split(numberedBlock).length - 1, 2);
  assert.deepEqual(
    checker.stdout.split('\n').filter((line) => /^[01]{8}$/.test(line)),
    [
      '11111111',
      '11111111',
      '11000011',
      '11000011',
      '11000011',
      '11000011',
      '11111111',
      '11111111',
      '01111111',
      '10111111',
      '11100011',
      '11000011',
      '11000011',
      '11000011',
      '11111111',
      '11111111',
      '11111111',
      '11111111',
      '11000011',
      '11000011',
      '11000011',
      '11000011',
      '11111111',
      '11111111',
    ],
  );
  assert.ok(checker.stdout.includes('ILLEGAL MOVE.  TRY AGAIN...'));
  assert.ok(checker.stdout.includes("PLEASE ANSWER 'YES' OR 'NO'."));
  assert.ok(checker.stdout.includes('YOU MADE1JUMPS AND HAD47PIECES'));
  assert.ok(checker.stdout.includes('YOU MADE0JUMPS AND HAD48PIECES'));
  assert.ok(checker.stdout.endsWith('O.K.  HOPE YOU HAD FUN!\n'));
  const rawChecker = runProcess({
    cwd: consumer,
    args: [executable, join(consumer, 'scripts/package/fixtures/classic/1check-raw.bas')],
    expectedStatus: 1,
  });
  assert.equal(rawChecker.stdout, '');
  assert.match(rawChecker.stderr, /Line 74, column \d+: Expected , after the PRINT USING template/);
  writeFileSync(file, '10 WAIT 0\n20 WAIT .1\n30 PRINT "waited"');
  const waited = runProcess({cwd: consumer, args: [executable, file]});
  assert.equal(waited.stdout, 'waited\n');
  assert.equal(waited.stderr, '');
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
    {
      source: '10 PRINT "started"\n20 WAIT 2147483647\n30 PRINT "must not finish"',
      marker: 'started\n',
    },
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
      source: '10 WAIT 2147483648',
      stdout: '',
      stderr: 'Line 10, column 9: WAIT duration must be from 0 through 2147483647 milliseconds\n',
    },
    {
      source: '10 WAIT -1',
      stdout: '',
      stderr: 'Line 10, column 9: WAIT duration must be from 0 through 2147483647 milliseconds\n',
    },
    {
      source: '10 PSET 1,2',
      stdout: '',
      stderr: 'Line 10, column 4: Graphics are not supported by this host\n',
    },
    {
      source: '10 PRINT INKEY$()',
      stdout: '',
      stderr: 'Line 10, column 10: Keyboard input is not supported by this host\n',
    },
    {
      source: '10 PRINT KEYDOWN("UP")',
      stdout: '',
      stderr: 'Line 10, column 10: Keyboard input is not supported by this host\n',
    },
    {
      source: '10 COLOR 2',
      stdout: '',
      stderr: 'Line 10, column 4: Graphics are not supported by this host\n',
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
