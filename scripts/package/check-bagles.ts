import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  baglesOptions,
  baglesSource,
  baglesTerminalTranscript,
  baglesTurns,
} from '../bagles-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkBaglesCli(executable: string, directory: string): void {
  const file = join(directory, 'bagles.basic.json');
  const saved = join(directory, 'bagles-copy.basic.json');
  const preload = join(directory, 'bagles-clock.ts');
  const document = {format: 'basic-program', version: 1, ...baglesOptions, source: baglesSource};
  writeFileSync(file, JSON.stringify(document));
  writeFileSync(preload, 'Math.random = () => 0;\n');
  const args = ['--preload', preload, executable];
  const input = baglesTurns.map(({answer}) => answer).join('\n') + '\n';

  const direct = runProcess({cwd: directory, args: [...args, file], input});
  assert.equal(direct.stderr, '');
  assert.equal(direct.stdout, baglesTerminalTranscript);

  const editor = runProcess({
    cwd: directory,
    args,
    input: `LOAD "${file}"\nSAVE "${saved}"\nNEW\nLOAD "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${baglesTerminalTranscript}>>> ${baglesTerminalTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
