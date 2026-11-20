import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  synonmOptions,
  synonmSource,
  synonmTerminalTranscript,
  synonmTurns,
} from '../synonm-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkSynonmCli(executable: string, directory: string): void {
  const file = join(directory, 'synonm.basic.json');
  const saved = join(directory, 'synonm-copy.basic.json');
  const preload = join(directory, 'synonm-clock.ts');
  const document = {format: 'basic-program', version: 1, ...synonmOptions, source: synonmSource};
  writeFileSync(file, JSON.stringify(document));
  writeFileSync(preload, 'Math.random = () => 0;\n');
  const args = ['--preload', preload, executable];
  const input = synonmTurns.map(({answer}) => answer).join('\n') + '\n';

  const direct = runProcess({cwd: directory, args: [...args, file], input});
  assert.equal(direct.stderr, '');
  assert.equal(direct.stdout, synonmTerminalTranscript);

  const editor = runProcess({
    cwd: directory,
    args,
    input: `LOAD "${file}"\nSAVE "${saved}"\nNEW\nLOAD "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${synonmTerminalTranscript}>>> ${synonmTerminalTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
