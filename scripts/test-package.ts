import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readdirSync,
  realpathSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, dirname, join, resolve} from 'node:path';
import metadata from '../package.json' with {type: 'json'};
import {libraryAcceptanceCases} from './library-acceptance.ts';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
const consumer = join(directory, 'consumer');

function run(
  command: string,
  args: string[],
  cwd = consumer,
  input = '',
  status = 0,
  env = process.env,
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    timeout: 60000,
    env,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, status, result.stderr || result.stdout);
  return result;
}

function bun(args: string[], cwd = consumer) {
  return run(process.execPath, args, cwd);
}

// Keep stdin open to expose accidental terminal setup or leaked input handles.
function runWithOpenInput(args: string[], interruptAt?: string) {
  return new Promise<{
    status: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd: consumer});
    let stdout = '';
    let stderr = '';
    let interrupted = false;
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Installed consumer did not finish with stdin open'));
    }, 5000);
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (interruptAt && !interrupted && stdout.includes(interruptAt)) {
        interrupted = true;
        child.kill('SIGINT');
      }
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      child.stdin.destroy();
      reject(error);
    });
    child.on('close', (status, signal) => {
      clearTimeout(timeout);
      child.stdin.destroy();
      resolve({status, signal, stdout, stderr});
    });
  });
}

try {
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
  const archive = join(directory, 'basic.tgz');
  bun(['pm', 'pack', '--filename', archive, '--ignore-scripts'], root);
  bun(['install', '--ignore-scripts', archive]);
  const installed = join(consumer, 'node_modules/node-basic-lang');
  assert.ok(existsSync(join(installed, 'src/index.ts')));
  assert.ok(existsSync(join(installed, 'examples/greeting.bas')));
  assert.ok(existsSync(join(installed, 'examples/guess.bas')));
  assert.ok(existsSync(join(installed, 'examples/times-table.bas')));
  const files = readdirSync(installed, {recursive: true}).map(String);
  assert.ok(!files.some((file) => file.endsWith('.test.ts') || file.includes('__tests__')));
  // Copy only the test harness; it has no runtime import from the checkout.
  copyFileSync(
    join(root, 'scripts/library-acceptance.ts'),
    join(consumer, 'library-acceptance.ts'),
  );

  // Resolve the public package name outside this checkout, in both formats.
  const exports =
    'Basic, createHost, parseLine, parseProgram, validateProgram, BasicSyntaxError, Evaluator, BasicRuntimeError';
  for (const [format, statement] of [
    ['module', `import {${exports}} from "node-basic-lang";`],
    ['commonjs', `const {${exports}} = require("node-basic-lang");`],
  ]) {
    const quiet = await runWithOpenInput([
      `--input-type=${format}`,
      '-e',
      `${statement} new Basic(); createHost(); new Evaluator();`,
    ]);
    assert.deepEqual(quiet, {status: 0, signal: null, stdout: '', stderr: ''});
    const executed = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
       const basic = new Basic({write: text => process.stdout.write(text)});
       basic.run('50 END\\n40 PRINT "package "; A\\n30 PRINT "skipped"\\n20 IF A=6 THEN 40\\n10 LET A = INT(2.9)*3');
       basic.run('10 GOTO 30\\n20 PRINT "skipped"\\n30 REM');
       basic.reset(parseProgram('10 PRINT "step"'));
       const result = basic.step();
       if (result.status !== 'halted' || result.currentLocation.label !== 10 ||
           result.nextLocation !== null || !Object.isFrozen(result)) process.exit(1);
       basic.run('10 FOR I=1 TO 2\\n20 PRINT I;\\n30 NEXT I\\n40 PRINT I');`,
    ]);
    assert.equal(executed.stdout, 'package 6\nstep\n123\n');
    assert.equal(executed.stderr, '');
    const parsed = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
       const program = parseProgram('20 END\\n10 LET A = 1+2*3');
       const replacement = parseLine('10 PRINT A;');
       const edited = validateProgram([program.lines[1], replacement]);
       if (program.lines[0].label !== 10 ||
           program.lines[0].statement.expression.right.operator !== '*' ||
           !edited.lines[0].statement.trailingSemicolon ||
           !Object.isFrozen(edited.lines[0].statement.items)) process.exit(1);
       let failure;
       try { parseProgram('10 PRINT 1+'); } catch (error) { failure = error; }
       if (!(failure instanceof BasicSyntaxError) ||
           failure.diagnostic.code !== 'EXPECTED_EXPRESSION' ||
           failure.diagnostic.label !== 10) process.exit(1);`,
    ]);
    assert.equal(parsed.stdout, '');
    assert.equal(parsed.stderr, '');
    const evaluated = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
       const evaluator = new Evaluator({random: () => 0.41});
       const assignment = parseLine('10 LET SECRET = INT(RND()*100)+1').statement;
       evaluator.assign(assignment.target, evaluator.evaluate(assignment.expression));
       const output = parseLine('20 PRINT SECRET+1').statement.items[0];
       if (evaluator.evaluate(output) !== 43) process.exit(1);
       evaluator.reset();
       let failure;
       try { evaluator.evaluate(output); } catch (error) { failure = error; }
       if (!(failure instanceof BasicRuntimeError) ||
           failure.diagnostic.code !== 'UNDEFINED_VARIABLE' ||
           failure.diagnostic.label !== 20 ||
           failure.diagnostic.column !== 10) process.exit(1);
       const branch = parseLine('10 IF 1 < 2 THEN 20');
       if (!evaluator.compare(branch.statement.condition)) process.exit(1);`,
    ]);
    assert.equal(evaluated.stdout, '');
    assert.equal(evaluated.stderr, '');
    const apiImport =
      format === 'module'
        ? 'import * as api from "node-basic-lang";'
        : 'const api = require("node-basic-lang");';
    const acceptance = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${apiImport}
       process.exitCode = 1;
       (async () => {
         const {runLibraryAcceptance} = await import('./library-acceptance.ts');
         const completed = await runLibraryAcceptance(api, ${JSON.stringify(join(installed, 'examples'))});
         process.stdout.write('LIBRARY_ACCEPTANCE_COMPLETE ' + JSON.stringify(completed) + '\\n');
         process.exitCode = 0;
       })().catch(error => { console.error(error); process.exitCode = 1; });`,
    ]);
    assert.equal(
      acceptance.stdout,
      `LIBRARY_ACCEPTANCE_COMPLETE ${JSON.stringify(libraryAcceptanceCases)}\n`,
    );
    assert.equal(acceptance.stderr, '');
  }

  const typedConsumer = join(consumer, 'consumer.ts');
  writeFileSync(
    typedConsumer,
    `
    import {Basic, parseLine, parseProgram, BasicSyntaxError, BasicRuntimeError, Evaluator,
            type BasicValue, type Host, type Program, type RunResult, type InputOptions,
            type Comparison, type ComparisonOperator, type RunOptions, type ExecutionScheduler} from 'node-basic-lang';
    const host: Host = {
      write(text: string) { void text; }, clear() {},
      async readLine() { return null; }, random() { return 0.5; },
    };
    const program: Program = parseProgram('10 PRINT 1');
    const basic = new Basic(host);
    basic.reset(program);
    const result: RunResult = basic.step();
    const label: number | null = result.currentLocation?.label ?? null;
    const diagnosticCode: string | undefined = basic.state.diagnostic?.code;
    basic.run(program);
    basic.run();
    const options: InputOptions = {signal: new AbortController().signal};
    const scheduler: ExecutionScheduler = async signal => { void signal.aborted; };
    const runOptions: RunOptions = {...options, instructionLimit: 10, yieldEvery: 2, scheduler};
    const asyncResult: RunResult = await basic.runAsync(program, runOptions);
    await basic.stepAsync(options);
    await basic.readLineAsync('20 REM', options);
    basic.cancel();
    void asyncResult;
    void label; void diagnosticCode;
    const evaluator = new Evaluator(host);
    const loops = parseProgram('10 FOR I=1 TO 2\\n20 NEXT I');
    const header = loops.lines[0].statement;
    if (header.type === 'ForStatement') {
      const name: string = header.variable.name;
      const defaultStep: boolean = header.step === null;
      void name; void defaultStep;
    }
    const branch = parseLine('10 IF 1 < 2 THEN 20');
    if (branch?.statement.type === 'IfStatement') {
      const condition: Comparison = branch.statement.condition;
      const operator: ComparisonOperator = condition.operator;
      const result: boolean = evaluator.compare(condition);
      void operator; void result;
    }
    try { parseProgram('10 PRINT 1+'); } catch (error) {
      if (!(error instanceof BasicSyntaxError)) throw error;
      const code: string = error.diagnostic.code;
      void code;
    }
    for (const line of program.lines) {
      if (line.statement.type === 'PrintStatement') {
        const expressions = line.statement.items;
        try {
          const value: BasicValue = evaluator.evaluate(expressions[0]);
          void value;
        } catch (error) {
          if (!(error instanceof BasicRuntimeError)) throw error;
          const code: string = error.diagnostic.code;
          void code;
        }
      }
      if (line.statement.type === 'LetStatement') {
        evaluator.assign(line.statement.target, evaluator.evaluate(line.statement.expression));
      }
    }
    evaluator.reset();
  `,
  );
  run(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ESNext',
    '--module',
    'Preserve',
    '--moduleResolution',
    'Bundler',
    '--allowImportingTsExtensions',
    typedConsumer,
  ]);

  const shim = join(
    consumer,
    'node_modules/.bin',
    process.platform === 'win32' ? 'basic.cmd' : 'basic',
  );
  assert.ok(existsSync(shim), 'Bun must install the basic executable');
  const executable =
    process.platform === 'win32' ? join(consumer, 'node_modules/node-basic-lang/bin/basic') : shim;
  const file = join(consumer, 'sample.bas');
  writeFileSync(
    file,
    '30 END\n20 PRINT "CLI "; NAME$\n10 LET NAME$ = "works"\n40 PRINT "unreachable"',
  );
  const executed = run(process.execPath, [executable, file]);
  assert.equal(executed.stdout, 'CLI works\n');
  assert.equal(executed.stderr, '');
  if (process.platform !== 'win32') {
    const direct = run(executable, [file]);
    assert.equal(direct.stdout, 'CLI works\n');
    assert.equal(direct.stderr, '');
  }
  assert.deepEqual(await runWithOpenInput([executable, file]), {
    status: 0,
    signal: null,
    stdout: 'CLI works\n',
    stderr: '',
  });
  writeFileSync(file, '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$');
  const input = run(process.execPath, [executable, file], consumer, 'Jesse\n');
  assert.equal(input.stdout, 'Name? Hello, Jesse\n');
  assert.equal(input.stderr, '');
  const table = run(
    process.execPath,
    [executable, join(installed, 'examples/times-table.bas')],
    consumer,
    '2\n',
  );
  assert.equal(
    table.stdout,
    'Which times table? ' +
      Array.from({length: 10}, (_, i) => `${i + 1} x 2 = ${(i + 1) * 2}\n`).join(''),
  );
  assert.equal(table.stderr, '');
  const greeting = run(
    process.execPath,
    [executable, join(installed, 'examples/greeting.bas')],
    consumer,
    '  Ada LoveLace  \n',
  );
  assert.equal(greeting.stdout, 'What is your name? Hello,   Ada LoveLace  !\n');
  assert.equal(greeting.stderr, '');

  const missing = run(
    process.execPath,
    [executable, join(consumer, 'missing.bas')],
    consumer,
    '',
    1,
  );
  assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /ENOENT/);
  assert.doesNotMatch(missing.stderr, /\n\s+at /);
  const usage = run(process.execPath, [executable, 'one.bas', 'two.bas'], consumer, '', 9);
  assert.equal(usage.stdout, '');
  assert.match(usage.stderr, /Usage:/);
  for (const [source, stderr] of [
    ['10 PRINT "must not run"\n20 PRINT "unfinished', 'Line 20, column 10: Unterminated string\n'],
    ['10 PRINT 1/0\n20 PRINT "skipped"', 'Line 10, column 11: Cannot divide by zero\n'],
    [
      '10 INPUT "Answer"; N\n20 PRINT "skipped"',
      'Line 10, column 4: Input ended before a value was received\n',
    ],
  ]) {
    writeFileSync(file, source);
    const failure = run(process.execPath, [executable, file], consumer, '', 1);
    assert.equal(failure.stdout, source.startsWith('10 INPUT') ? 'Answer? ' : '');
    assert.equal(failure.stderr, stderr);
  }
  if (process.platform !== 'win32') {
    const cancelled = await runWithOpenInput([executable, file], 'Answer? ');
    assert.deepEqual(cancelled, {status: 130, signal: null, stdout: 'Answer? ', stderr: ''});
    for (const loop of ['20 GOTO 20', '20 FOR I=1 TO 1000000000\n30 NEXT I']) {
      writeFileSync(file, `10 PRINT "started"\n${loop}\n40 PRINT "must not finish"`);
      assert.deepEqual(await runWithOpenInput([executable, file], 'started\n'), {
        status: 130,
        signal: null,
        stdout: 'started\n',
        stderr: '',
      });
    }
  }
  const interactive = run(process.execPath, [executable]);
  assert.equal(interactive.stdout.split('\n')[0], `BASIC ${metadata.version}`);
  assert.equal(interactive.stderr, '');

  // Exercise global command discovery in an unrelated directory without touching
  // the developer's real global installation or resolving the local .bin link.
  if (process.platform !== 'win32') {
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
    run(
      process.execPath,
      ['install', '--global', '--ignore-scripts', archive],
      unrelated,
      '',
      0,
      env,
    );
    assert.equal(
      realpathSync(join(globalBin, 'basic')),
      realpathSync(join(globalDirectory, 'node_modules/node-basic-lang/bin/basic')),
    );
    writeFileSync(file, '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$');
    const globalInput = run('basic', [file], unrelated, 'Ada\n', 0, env);
    assert.equal(globalInput.stdout, 'Name? Hello, Ada\n');
    assert.equal(globalInput.stderr, '');
    writeFileSync(file, '10 PRINT 1/0');
    const globalError = run('basic', [file], unrelated, '', 1, env);
    assert.equal(globalError.stdout, '');
    assert.equal(globalError.stderr, 'Line 10, column 11: Cannot divide by zero\n');
  }
  console.log(
    `Packed package: ${libraryAcceptanceCases.length} shared library cases in ESM/CommonJS, types, CLI output/errors/EOF/SIGINT, open-stdin lifecycle, and POSIX global install passed.`,
  );
} finally {
  rmSync(directory, {recursive: true, force: true});
}
