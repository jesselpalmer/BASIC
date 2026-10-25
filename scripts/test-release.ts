import assert from 'node:assert/strict';
import {mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {checkArchive} from './package/check-archive.ts';
import {validateManifest} from './release/manifest.ts';
import {checkArchiveEntries} from './release/archive.ts';
import {runProcess} from './subprocess.ts';

const root = resolve(import.meta.dirname, '..');
const directory = join(root, 'dist/release');
const manifest = validateManifest(root, directory);
const [packageArtifact, playgroundArtifact] = manifest.artifacts;
await checkArchive(root, join(directory, packageArtifact.name));
const extracted = mkdtempSync(join(tmpdir(), 'basic-static-'));
try {
  const folder = `BASIC-playground-${manifest.version}`;
  const expected = ['app.js', 'app.js.map', 'index.html', 'styles.css'].map(
    (name) => `${folder}/${name}`,
  );
  checkArchiveEntries(join(directory, playgroundArtifact.name), expected);
  runProcess({
    command: 'tar',
    args: ['-xzf', join(directory, playgroundArtifact.name), '-C', extracted],
  });
  assert.deepEqual(readdirSync(join(extracted, folder)).sort(), [
    'app.js',
    'app.js.map',
    'index.html',
    'styles.css',
  ]);
  // Playwright starts only Python's generic static HTTP server against this extracted
  // directory. Test oracles may read source, but the browser cannot fetch checkout files.
  const browser = Bun.spawn(
    [
      process.execPath,
      join(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      join(root, 'scripts/browser/playwright.config.ts'),
    ],
    {
      cwd: extracted,
      env: {...process.env, BASIC_BROWSER_STATIC_ROOT: join(extracted, folder)},
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  assert.equal(await browser.exited, 0, 'Extracted static artifact browser acceptance');
  validateManifest(root, directory);
  console.log(`RELEASE_VALIDATED ${JSON.stringify(manifest)}`);
} finally {
  rmSync(extracted, {recursive: true, force: true});
}
