import assert from 'node:assert/strict';
import {join} from 'node:path';
import {libraryAcceptanceCases} from '../library-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkLibraryConsumers(consumer: string, installed: string): Promise<void> {
  for (const format of ['esm', 'commonjs']) {
    const entry = join(consumer, 'scripts/package/fixtures', `${format}.ts`);
    const quiet = await runWithOpenInput({cwd: consumer, args: [entry, 'quiet']});
    assert.deepEqual(quiet, {status: 0, signal: null, stdout: '', stderr: ''}, `${format} import`);
    const acceptance = runProcess({
      cwd: consumer,
      args: [entry, join(installed, 'examples')],
    });
    assert.equal(
      acceptance.stdout,
      `LIBRARY_ACCEPTANCE_COMPLETE ${JSON.stringify(libraryAcceptanceCases)}\n`,
      `${format} must complete every library case`,
    );
    assert.equal(acceptance.stderr, '');
  }
}

export function checkConsumerTypes(root: string, consumer: string): void {
  runProcess({
    cwd: consumer,
    timeout: 60000,
    args: [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ESNext',
      '--module',
      'Preserve',
      '--moduleResolution',
      'Bundler',
      '--allowImportingTsExtensions',
      join(consumer, 'scripts/package/fixtures/types.ts'),
    ],
  });
}
