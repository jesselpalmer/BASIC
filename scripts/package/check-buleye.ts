import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  buleyeOptions,
  buleyeSource,
  buleyeTerminalTranscript,
  buleyeTurns,
} from '../buleye-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkBuleyeCli(executable: string, directory: string): void {
  const file = join(directory, 'buleye.basic.json');
  const saved = join(directory, 'buleye-copy.basic.json');
  const preload = join(directory, 'buleye-clock.ts');
  const document = {format: 'basic-program', version: 1, ...buleyeOptions, source: buleyeSource};
  writeFileSync(file, JSON.stringify(document));
  writeFileSync(preload, 'Math.random = () => 0;\n');
  const args = ['--preload', preload, executable];
  const input = buleyeTurns.map(({answer}) => answer).join('\n') + '\n';

  const direct = runProcess({cwd: directory, args: [...args, file], input});
  assert.equal(direct.stderr, '');
  assert.equal(direct.stdout, buleyeTerminalTranscript);

  const editor = runProcess({
    cwd: directory,
    args,
    input: `LOAD "${file}"\nSAVE "${saved}"\nNEW\nLOAD "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${buleyeTerminalTranscript}>>> ${buleyeTerminalTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
