import assert from 'node:assert/strict';
import {runProcess} from '../subprocess.ts';

/** Reject links, unexpected files and traversal before extracting either archive. */
export function checkArchiveEntries(archive: string, expected: string[]): void {
  const listing = runProcess({command: 'tar', args: ['-tzf', archive]})
    .stdout.trim()
    .split('\n')
    .map((name) => name.replace(/^\.\//, ''));
  const details = runProcess({command: 'tar', args: ['-tvzf', archive]})
    .stdout.trim()
    .split('\n');
  assert.ok(
    details.every((line) => line.startsWith('-') || line.startsWith('d')),
    'Archive may contain only regular files and directories',
  );
  assert.deepEqual(
    listing.filter((name) => !name.endsWith('/')).sort(),
    [...expected].sort(),
    'Archive must contain exactly its production allowlist',
  );
  assert.ok(
    listing.every((name) => !name.endsWith('/') || expected.some((file) => file.startsWith(name))),
    'Archive has an unexpected directory',
  );
}
