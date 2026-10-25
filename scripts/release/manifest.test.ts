import {expect, test} from 'bun:test';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  artifact,
  artifactNames,
  candidate,
  validateManifest,
  type ReleaseManifest,
} from './manifest.ts';
import {checkArchiveEntries} from './archive.ts';
import {runProcess} from '../subprocess.ts';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'basic-manifest-test-'));
  const root = join(directory, 'candidate');
  const output = join(directory, 'output');
  mkdirSync(root);
  mkdirSync(output);
  writeFileSync(join(root, 'package.json'), '{"name":"node-basic-lang","version":"1.0.0"}\n');
  const git = (...args: string[]) => runProcess({command: 'git', cwd: root, args});
  git('init', '-q');
  git('add', 'package.json');
  git(
    '-c',
    'user.name=Release Test',
    '-c',
    'user.email=release@example.invalid',
    'commit',
    '-qm',
    'fixture',
  );
  const manifest: ReleaseManifest = {
    schema: 1,
    version: '1.0.0',
    ...candidate(root),
    tools: {bun: Bun.version, npm: 'test', platform: process.platform, architecture: process.arch},
    artifacts: artifactNames('1.0.0').map((name) => {
      writeFileSync(join(output, name), name);
      return artifact(output, name);
    }),
  };
  const save = () => writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest));
  save();
  return {directory, root, output, manifest, save};
}

test('release validation accepts recorded bytes and rejects tampering', () => {
  const f = fixture();
  try {
    expect(validateManifest(f.root, f.output)).toEqual(f.manifest);
    writeFileSync(join(f.output, f.manifest.artifacts[0].name), 'changed');
    expect(() => validateManifest(f.root, f.output)).toThrow('Archive checksum or size changed');
  } finally {
    rmSync(f.directory, {recursive: true, force: true});
  }
});

test('release validation binds the exact commit and ordered artifact names', () => {
  const f = fixture();
  try {
    f.manifest.commit = '0'.repeat(40);
    f.save();
    expect(() => validateManifest(f.root, f.output)).toThrow('exact candidate');
    f.manifest.commit = candidate(f.root).commit;
    f.manifest.artifacts[0].name = '../outside.tgz';
    f.save();
    expect(() => validateManifest(f.root, f.output)).toThrow();
  } finally {
    rmSync(f.directory, {recursive: true, force: true});
  }
});

test('release validation refuses a candidate changed after packing', () => {
  const f = fixture();
  try {
    writeFileSync(
      join(f.root, 'package.json'),
      readFileSync(join(f.root, 'package.json'), 'utf8').replace('1.0.0', '1.0.1'),
    );
    expect(() => validateManifest(f.root, f.output)).toThrow('clean candidate checkout');
  } finally {
    rmSync(f.directory, {recursive: true, force: true});
  }
});

test('archive validation rejects extra files and symbolic links before extraction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'basic-archive-test-'));
  try {
    const stage = join(directory, 'stage');
    mkdirSync(stage);
    writeFileSync(join(stage, 'app.js'), 'app');
    const archive = join(directory, 'static.tar.gz');
    const pack = () =>
      runProcess({command: 'tar', args: ['-czf', archive, '-C', stage, 'app.js', 'extra']});
    writeFileSync(join(stage, 'extra'), 'unexpected');
    pack();
    expect(() => checkArchiveEntries(archive, ['app.js'])).toThrow('production allowlist');
    rmSync(join(stage, 'extra'));
    symlinkSync('app.js', join(stage, 'extra'));
    pack();
    expect(() => checkArchiveEntries(archive, ['app.js', 'extra'])).toThrow('regular files');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
