import assert from 'node:assert/strict';
import {
  copyFileSync,
  cpSync,
  existsSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {libraryAcceptanceCases} from './library-acceptance.ts';
import {checkGlobalCli, checkLocalCli} from './package/check-cli.ts';
import {checkConsumerTypes, checkLibraryConsumers} from './package/check-library.ts';
import {runProcess} from './subprocess.ts';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
const consumer = join(directory, 'consumer');
const archive = join(directory, 'basic.tgz');

try {
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
  runProcess({
    cwd: root,
    args: ['pm', 'pack', '--filename', archive, '--ignore-scripts'],
    timeout: 60000,
  });
  runProcess({cwd: consumer, args: ['install', '--ignore-scripts', archive], timeout: 60000});
  const installed = join(consumer, 'node_modules/node-basic-lang');
  for (const file of [
    'src/index.ts',
    'examples/greeting.bas',
    'examples/guess.bas',
    'examples/times-table.bas',
  ]) {
    assert.ok(existsSync(join(installed, file)), `Missing packaged file: ${file}`);
  }
  const files = readdirSync(installed, {recursive: true}).map(String);
  assert.ok(
    !files.some((file) => /\.(test|spec)\.ts$/.test(file) || file.includes('__tests__')),
    'Test infrastructure must not be packaged',
  );

  // Preserve fixture-relative imports but copy no runtime source from the checkout.
  // The harness's references to source are erased type imports only.
  cpSync(join(root, 'scripts/package/fixtures'), join(consumer, 'scripts/package/fixtures'), {
    recursive: true,
  });
  copyFileSync(
    join(root, 'scripts/library-acceptance.ts'),
    join(consumer, 'scripts/library-acceptance.ts'),
  );
  await checkLibraryConsumers(consumer, installed);
  checkConsumerTypes(root, consumer);
  await checkLocalCli(consumer, installed);
  checkGlobalCli(directory, archive);
  console.log(
    `Packed package: ${libraryAcceptanceCases.length} shared library cases in ESM/CommonJS, ` +
      'positive/negative public types, CLI errors/input/interruption, editor recovery, ' +
      'and POSIX global install passed.',
  );
} finally {
  rmSync(directory, {recursive: true, force: true});
}
