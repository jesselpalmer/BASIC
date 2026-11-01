import assert from 'node:assert/strict';
import {
  copyFileSync,
  cpSync,
  existsSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {libraryAcceptanceCases} from '../library-acceptance.ts';
import {checkGlobalCli, checkLocalCli} from './check-cli.ts';
import {checkConsumerTypes, checkLibraryConsumers} from './check-library.ts';
import {runProcess} from '../subprocess.ts';
import {checkArchiveEntries} from '../release/archive.ts';

function files(directory: string): string[] {
  return readdirSync(directory, {recursive: true})
    .map(String)
    .filter((name) => statSync(join(directory, name)).isFile());
}

/** Validate exactly the archive supplied, without packing a replacement. */
export async function checkArchive(root: string, archive: string): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'basic-package-'));
  const consumer = join(directory, 'consumer');
  try {
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
    // Only committed production files may ship. Ignored/untracked files must
    // never expand the allowlist merely because they exist in this checkout.
    const expected = runProcess({
      command: 'git',
      cwd: root,
      args: [
        'ls-files',
        '-z',
        '--',
        'package.json',
        'README.md',
        'LICENSE',
        'CHANGELOG.md',
        'bin',
        'src',
        'docs',
        'examples',
      ],
    })
      .stdout.split('\0')
      .filter((name) => name && !/\.(test|spec)\.ts$/.test(name) && !name.includes('__tests__/'))
      .sort();
    checkArchiveEntries(
      archive,
      expected.map((name) => `package/${name}`),
    );
    runProcess({cwd: consumer, args: ['install', '--ignore-scripts', archive], timeout: 60000});
    const installed = join(consumer, 'node_modules/node-basic-lang');
    // Bun adds this installation marker; it is not part of the archive.
    const actual = files(installed)
      .filter((name) => name !== '.bun-tag')
      .map((file) => relative(installed, join(installed, file)))
      .sort();
    assert.deepEqual(actual, expected, 'Archive must contain exactly the production allowlist');
    for (const file of ['docs/release-checklist.md', 'examples/pong.bas'])
      assert.ok(existsSync(join(installed, file)), `Missing packaged file: ${file}`);
    for (const file of actual)
      assert.deepEqual(
        readFileSync(join(installed, file)),
        readFileSync(join(root, file)),
        `Packaged bytes differ: ${file}`,
      );
    const sourceMetadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      version: string;
    };
    const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    assert.equal(metadata.name, 'node-basic-lang');
    assert.equal(metadata.version, sourceMetadata.version);
    assert.ok(statSync(join(installed, 'bin/basic')).mode & 0o111, 'CLI must remain executable');
    // Copy test oracles only. Runtime imports resolve solely to the installed archive.
    cpSync(join(root, 'scripts/package/fixtures'), join(consumer, 'scripts/package/fixtures'), {
      recursive: true,
    });
    for (const harness of [
      'library-acceptance.ts',
      'array-acceptance.ts',
      'output-acceptance.ts',
      'matches-acceptance.ts',
    ]) {
      copyFileSync(join(root, 'scripts', harness), join(consumer, 'scripts', harness));
    }
    await checkLibraryConsumers(consumer, installed);
    checkConsumerTypes(root, consumer);
    await checkLocalCli(consumer, installed);
    checkGlobalCli(directory, archive);
    console.log(
      `Packed package: ${libraryAcceptanceCases.length} shared library cases in ESM/CommonJS, positive/negative public types, CLI errors/input/interruption, editor recovery, and POSIX global install passed.`,
    );
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}
