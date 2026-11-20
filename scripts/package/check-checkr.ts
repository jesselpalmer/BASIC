import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  checkrOptions,
  checkrSource,
  checkrTerminalTranscript,
  checkrAnswers,
} from '../checkr-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkCheckrCli(executable: string, directory: string): void {
  const file = join(directory, 'checkr.basic.json');
  const saved = join(directory, 'checkr-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...checkrOptions, source: checkrSource};
  writeFileSync(file, JSON.stringify(document));
  const input = checkrAnswers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [executable, file], input, timeout: 20000});
  assert.equal(direct.stderr, '');
  assert.equal(direct.stdout, checkrTerminalTranscript);
  const editor = runProcess({
    cwd: directory,
    args: [executable],
    input: `LOAD "${file}"\nSAVE "${saved}"\nNEW\nLOAD "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
    timeout: 30000,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${checkrTerminalTranscript}>>> ${checkrTerminalTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
