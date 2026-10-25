import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {
  artifact,
  artifactNames,
  candidate,
  metadata,
  type ReleaseManifest,
} from './release/manifest.ts';
import {runProcess} from './subprocess.ts';

const root = resolve(import.meta.dirname, '..');
const source = candidate(root);
const {version} = metadata(root);
const directory = join(root, 'dist/release');
const [packageName, playgroundName] = artifactNames(version);
rmSync(directory, {recursive: true, force: true});
mkdirSync(directory, {recursive: true});
const packed = JSON.parse(
  runProcess({
    command: 'npm',
    cwd: root,
    args: ['pack', '--json', '--ignore-scripts', '--pack-destination', directory],
    timeout: 60000,
  }).stdout,
) as {filename: string}[];
assert.equal(packed.length, 1);
assert.equal(packed[0].filename, packageName);
runProcess({cwd: root, args: ['scripts/build-playground.ts'], timeout: 60000});
const stage = mkdtempSync(join(tmpdir(), 'basic-release-'));
try {
  const folder = `BASIC-playground-${version}`;
  mkdirSync(join(stage, folder));
  for (const file of ['index.html', 'styles.css', 'app.js', 'app.js.map'])
    copyFileSync(join(root, 'dist/playground', file), join(stage, folder, file));
  runProcess({
    command: 'tar',
    args: ['-czf', join(directory, playgroundName), '-C', stage, folder],
    timeout: 60000,
  });
} finally {
  rmSync(stage, {recursive: true, force: true});
}
const manifest: ReleaseManifest = {
  schema: 1,
  version,
  ...source,
  tools: {
    bun: Bun.version,
    npm: runProcess({command: 'npm', args: ['--version']}).stdout.trim(),
    platform: process.platform,
    architecture: process.arch,
  },
  artifacts: [packageName, playgroundName].map((name) => artifact(directory, name)),
};
writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`RELEASE_MANIFEST ${JSON.stringify(manifest)}`);
