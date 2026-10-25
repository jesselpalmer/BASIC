import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {checkArchive} from './package/check-archive.ts';
import {runProcess} from './subprocess.ts';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'basic-pack-'));
try {
  const archive = join(directory, 'basic.tgz');
  runProcess({
    cwd: root,
    args: ['pm', 'pack', '--filename', archive, '--ignore-scripts'],
    timeout: 60000,
  });
  await checkArchive(root, archive);
} finally {
  rmSync(directory, {recursive: true, force: true});
}
