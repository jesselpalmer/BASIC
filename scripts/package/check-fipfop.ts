import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fipfopOptions, fipfopSource, fipfopTranscript, fipfopTurns} from '../fipfop-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkFipfopCli(executable: string, directory: string): void {
  const file = join(directory, 'fipfop.basic.json');
  const saved = join(directory, 'fipfop-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...fipfopOptions, source: fipfopSource};
  writeFileSync(file, JSON.stringify(document));
  const input = fipfopTurns.map(({answer}) => answer).join('\n') + '\n';
  const result = runProcess({cwd: directory, args: [executable, file], input});
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, fipfopTranscript);

  const editor = runProcess({
    cwd: directory,
    args: [executable],
    input: `LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${fipfopTranscript}>>> ${fipfopTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
