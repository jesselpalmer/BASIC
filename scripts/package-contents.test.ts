import {expect, it} from 'bun:test';
import {existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import metadata from '../package.json' with {type: 'json'};
import {runProcess} from './subprocess.ts';

it('packs source while excluding test/spec files and test helpers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'basic-package-contents-'));
  const source = join(directory, 'package');
  const consumer = join(directory, 'consumer');
  const archive = join(directory, 'fixture.tgz');
  try {
    mkdirSync(join(source, 'src/nested/__tests__'), {recursive: true});
    mkdirSync(consumer);
    writeFileSync(
      join(source, 'package.json'),
      JSON.stringify({name: 'basic-contents-fixture', version: '0.0.0', files: metadata.files}),
    );
    writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
    const excluded = [
      'nested/example.test.ts',
      'nested/example.spec.ts',
      'nested/__tests__/helper.ts',
    ];
    for (const path of ['index.ts', ...excluded]) {
      writeFileSync(join(source, 'src', path), 'export const marker = true;\n');
    }
    runProcess({cwd: source, args: ['pm', 'pack', '--filename', archive, '--ignore-scripts']});
    runProcess({cwd: consumer, args: ['install', '--ignore-scripts', archive]});
    const installed = join(consumer, 'node_modules/basic-contents-fixture/src');
    expect(existsSync(join(installed, 'index.ts'))).toBe(true);
    for (const path of excluded) expect(existsSync(join(installed, path))).toBe(false);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
