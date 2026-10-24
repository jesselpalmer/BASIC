import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import metadata from '../package.json' with {type: 'json'};

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
const consumer = join(directory, 'consumer');

function run(command: string, args: string[], cwd = consumer, input = '') {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    timeout: 60000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function bun(args: string[], cwd = consumer) {
  return run(process.execPath, args, cwd);
}

try {
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
  const archive = join(directory, 'basic.tgz');
  bun(['pm', 'pack', '--filename', archive, '--ignore-scripts'], root);
  bun(['install', '--ignore-scripts', archive]);
  const installed = join(consumer, 'node_modules/node-basic-lang');
  assert.ok(existsSync(join(installed, 'src/index.ts')));
  const files = readdirSync(installed, {recursive: true}).map(String);
  assert.ok(!files.some((file) => file.endsWith('.test.ts') || file.includes('__tests__')));

  // Resolve the public package name outside this checkout, in both formats.
  const exports =
    'Basic, createHost, parseLine, parseProgram, validateProgram, BasicSyntaxError, Evaluator, BasicRuntimeError';
  for (const [format, statement] of [
    ['module', `import {${exports}} from "node-basic-lang";`],
    ['commonjs', `const {${exports}} = require("node-basic-lang");`],
  ]) {
    const quiet = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement} new Basic(); createHost(); new Evaluator();`,
    ]);
    assert.equal(quiet.stdout, '');
    assert.equal(quiet.stderr, '');
    const executed = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
       const basic = new Basic({write: text => process.stdout.write(text)});
       basic.run('30 END\\n20 PRINT "package "; A\\n10 LET A = INT(2.9)*3');
       basic.reset(parseProgram('10 PRINT "step"'));
       const result = basic.step();
       if (result.status !== 'halted' || result.currentLocation.label !== 10 ||
           result.nextLocation !== null || !Object.isFrozen(result)) process.exit(1);`,
    ]);
    assert.equal(executed.stdout, 'package 6\nstep\n');
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
           failure.diagnostic.column !== 10) process.exit(1);`,
    ]);
    assert.equal(evaluated.stdout, '');
    assert.equal(evaluated.stderr, '');
    const input = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
      (async () => {
        const prompts = [];
        const answers = ['bad', '2'];
        const basic = new Basic({write: text => process.stdout.write(text),
          readLine: prompt => { prompts.push(prompt); return Promise.resolve(answers.shift()); }});
        const result = await basic.runAsync('10 INPUT "Number"; N\\n20 PRINT N*2');
        if (result.status !== 'halted' || prompts.join('|') !== 'Number? |Number? ') process.exit(1);
      })().catch(error => { console.error(error); process.exitCode = 1; });`,
    ]);
    assert.equal(input.stdout, 'Invalid number; please enter a finite decimal.\n4\n');
    assert.equal(input.stderr, '');
  }

  const typedConsumer = join(consumer, 'consumer.ts');
  writeFileSync(
    typedConsumer,
    `
    import {Basic, parseProgram, BasicSyntaxError, BasicRuntimeError, Evaluator,
            type BasicValue, type Host, type Program, type RunResult, type InputOptions} from 'node-basic-lang';
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
    const asyncResult: RunResult = await basic.runAsync(program, options);
    await basic.stepAsync(options);
    await basic.readLineAsync('20 REM', options);
    basic.cancel();
    void asyncResult;
    void label; void diagnosticCode;
    const evaluator = new Evaluator(host);
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
    assert.equal(run(executable, [file]).stdout, 'CLI works\n');
  }
  writeFileSync(file, '10 INPUT "Name"; N$\n20 PRINT "Hello, ";N$');
  const input = run(process.execPath, [executable, file], consumer, 'Jesse\n');
  assert.equal(input.stdout, 'Name? Hello, Jesse\n');
  assert.equal(input.stderr, '');
  const interactive = run(process.execPath, [executable]);
  assert.equal(interactive.stdout.split('\n')[0], `BASIC ${metadata.version}`);
  assert.equal(interactive.stderr, '');
  console.log('Packed package: imports, parser, evaluator, basic, and banner passed.');
} finally {
  rmSync(directory, {recursive: true, force: true});
}
