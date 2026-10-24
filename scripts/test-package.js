import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import metadata from '../package.json' with {type: 'json'};

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
const consumer = join(directory, 'consumer');

function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', input: '', timeout: 60000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function npm(args, cwd) {
  return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
}

try {
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
  const [packed] = JSON.parse(npm([
    'pack', '--json', '--ignore-scripts', '--pack-destination', directory,
  ], root).stdout);
  const files = packed.files.map(({path}) => path);
  assert.ok(files.includes('src/index.js'));
  assert.ok(files.includes('bin/basic'));
  assert.ok(!files.some((file) =>
    file.startsWith('lib/') || file.includes('__tests__/') ||
    file.endsWith('.test.js')));

  npm([
    'install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund',
    join(directory, packed.filename),
  ]);

  // Resolve the public package name outside this checkout, in both formats.
  const exports = 'Basic, createHost, parseLine, parseProgram, validateProgram';
  for (const [format, statement] of [
    ['module', `import {${exports}} from "node-basic-lang";`],
    ['commonjs', `const {${exports}} = require("node-basic-lang");`],
  ]) {
    const quiet = run(process.execPath, [`--input-type=${format}`, '-e',
      `${statement} new Basic(); createHost();`,
    ]);
    assert.equal(quiet.stdout, '');
    assert.equal(quiet.stderr, '');
    const executed = run(process.execPath, [`--input-type=${format}`, '-e',
      `${statement}
       const basic = new Basic({write: text => process.stdout.write(text)});
       basic.run('10 PRINT "package works"');`,
    ]);
    assert.equal(executed.stdout, 'package works\n');
    assert.equal(executed.stderr, '');
    const parsed = run(process.execPath, [`--input-type=${format}`, '-e',
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

  const shim = join(consumer, 'node_modules/.bin',
      process.platform === 'win32' ? 'basic.cmd' : 'basic');
  assert.ok(existsSync(shim), 'npm must install the basic executable');
  const executable = process.platform === 'win32' ?
    join(consumer, 'node_modules/node-basic-lang/bin/basic') : shim;
  const file = join(consumer, 'sample.bas');
  writeFileSync(file, '10 PRINT "CLI works"\n20 END\n30 PRINT "unreachable"');
  const executed = run(process.execPath, [executable, file]);
  assert.equal(executed.stdout, 'CLI works\n');
  assert.equal(executed.stderr, '');
  const interactive = run(process.execPath, [executable]);
  assert.equal(interactive.stdout.split('\n')[0], `BASIC ${metadata.version}`);
  assert.equal(interactive.stderr, '');
  console.log('Packed package: imports, parser, basic, and banner passed.');
} finally {
  rmSync(directory, {recursive: true, force: true});
}
