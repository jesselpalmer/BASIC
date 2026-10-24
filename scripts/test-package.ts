import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import metadata from '../package.json' with {type: 'json'};

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
const consumer = join(directory, 'consumer');

function run(command: string, args: string[], cwd = consumer) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input: '',
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
  const exports = 'Basic, createHost, parseLine, parseProgram, validateProgram';
  for (const [format, statement] of [
    ['module', `import {${exports}} from "node-basic-lang";`],
    ['commonjs', `const {${exports}} = require("node-basic-lang");`],
  ]) {
    const quiet = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement} new Basic(); createHost();`,
    ]);
    assert.equal(quiet.stdout, '');
    assert.equal(quiet.stderr, '');
    const executed = run(process.execPath, [
      `--input-type=${format}`,
      '-e',
      `${statement}
       const basic = new Basic({write: text => process.stdout.write(text)});
       basic.run('10 PRINT "package works"');`,
    ]);
    assert.equal(executed.stdout, 'package works\n');
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
           !Object.isFrozen(edited.lines[0].statement.items)) process.exit(1);`,
    ]);
    assert.equal(parsed.stdout, '');
    assert.equal(parsed.stderr, '');
  }

  const typedConsumer = join(consumer, 'consumer.ts');
  writeFileSync(
    typedConsumer,
    `
    import {Basic, parseProgram, type Host, type Program} from 'node-basic-lang';
    const host: Host = {
      write(text: string) { void text; }, clear() {},
      async readLine() { return null; }, random() { return 0.5; },
    };
    const program: Program = parseProgram('10 PRINT 1');
    new Basic(host);
    for (const line of program.lines) {
      if (line.statement.type === 'PrintStatement') {
        const expressions = line.statement.items;
        void expressions;
      }
    }
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
  writeFileSync(file, '10 PRINT "CLI works"\n20 END\n30 PRINT "unreachable"');
  const executed = run(process.execPath, [executable, file]);
  assert.equal(executed.stdout, 'CLI works\n');
  assert.equal(executed.stderr, '');
  if (process.platform !== 'win32') {
    assert.equal(run(executable, [file]).stdout, 'CLI works\n');
  }
  const interactive = run(process.execPath, [executable]);
  assert.equal(interactive.stdout.split('\n')[0], `BASIC ${metadata.version}`);
  assert.equal(interactive.stderr, '');
  console.log('Packed package: imports, parser, basic, and banner passed.');
} finally {
  rmSync(directory, {recursive: true, force: true});
}
