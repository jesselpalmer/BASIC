import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {runProcess} from '../subprocess.ts';

export interface ReleaseArtifact {
  name: string;
  bytes: number;
  sha256: string;
}
export interface ReleaseManifest {
  schema: 1;
  version: string;
  commit: string;
  tree: string;
  tools: {bun: string; npm: string; platform: string; architecture: string};
  artifacts: ReleaseArtifact[];
}
export function metadata(root: string): {name: string; version: string} {
  const value = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  assert.equal(value.name, 'node-basic-lang');
  assert.match(value.version, /^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/i);
  return value;
}
export function candidate(root: string): {commit: string; tree: string} {
  const git = (...args: string[]) => runProcess({command: 'git', cwd: root, args}).stdout.trim();
  assert.equal(
    git('status', '--porcelain', '--untracked-files=normal'),
    '',
    'Release artifacts require a clean candidate checkout',
  );
  const commit = git('rev-parse', 'HEAD');
  const tree = git('rev-parse', 'HEAD^{tree}');
  assert.match(commit, /^[a-f\d]{40}$/);
  return {commit, tree};
}
export function artifact(directory: string, name: string): ReleaseArtifact {
  assert.equal(name.includes('/'), false);
  return {
    name,
    bytes: statSync(join(directory, name)).size,
    sha256: createHash('sha256')
      .update(readFileSync(join(directory, name)))
      .digest('hex'),
  };
}
export function artifactNames(version: string): [string, string] {
  return [`node-basic-lang-${version}.tgz`, `BASIC-playground-${version}.tar.gz`];
}
export function validateManifest(root: string, directory: string): ReleaseManifest {
  const manifest = JSON.parse(
    readFileSync(join(directory, 'manifest.json'), 'utf8'),
  ) as ReleaseManifest;
  const source = candidate(root);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.version, metadata(root).version);
  assert.equal(manifest.commit, source.commit, 'Manifest must identify this exact candidate');
  assert.equal(manifest.tree, source.tree);
  assert.deepEqual(
    manifest.artifacts.map(({name}) => name),
    artifactNames(manifest.version),
  );
  for (const entry of manifest.artifacts)
    assert.deepEqual(artifact(directory, entry.name), entry, 'Archive checksum or size changed');
  return manifest;
}
