import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runProcess} from '../subprocess.ts';
import {war2Options, war2Runs, war2Source} from '../war2-acceptance.ts';

export function checkWar2Cli(executable: string, directory: string): void {
  const file = join(directory, 'war2.basic.json');
  writeFileSync(
    file,
    JSON.stringify({format: 'basic-program', version: 1, ...war2Options, source: war2Source}),
  );
  for (const run of war2Runs) {
    const input = run.answers.join('\n') + '\n';
    const result = runProcess({cwd: directory, args: [executable, file], input});
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, run.output, run.name);
    const editor = runProcess({
      cwd: directory,
      args: [executable],
      input: `LOAD "${file}"\nRUN\n${input}EXIT\n`,
    });
    assert.equal(editor.stderr, '');
    assert.ok(editor.stdout.includes(run.output), editor.stdout);
  }
}
