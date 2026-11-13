import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {diceOptions, diceRuns, diceSource} from '../dice-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkDiceCli(executable: string, directory: string): void {
  const file = join(directory, 'dice.basic.json');
  writeFileSync(
    file,
    JSON.stringify({format: 'basic-program', version: 1, ...diceOptions, source: diceSource}),
  );
  for (const run of diceRuns) {
    const result = runProcess({
      cwd: directory,
      args: [executable, file],
      input: run.answers.join('\n') + '\n',
    });
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, run.output, run.name);
  }
  const editor = runProcess({
    cwd: directory,
    args: [executable],
    input: [
      `LOAD "${file}"`,
      ...diceRuns.flatMap((run) => ['RUN', ...run.answers]),
      'EXIT',
      '',
    ].join('\n'),
  });
  assert.equal(editor.stderr, '');
  let offset = 0;
  for (const run of diceRuns) {
    const start = editor.stdout.indexOf(run.output, offset);
    assert.ok(start >= 0, editor.stdout);
    offset = start + run.output.length;
  }
}
