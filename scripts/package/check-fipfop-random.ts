import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  fipfopRandomOptions,
  fipfopRandomSource,
  fipfopRandomTranscript,
  fipfopRandomTurns,
} from '../fipfop-random-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkFipfopRandomCli(executable: string, directory: string): void {
  checkFipfopSourceCli(executable, directory, 'fipfop-random', fipfopRandomSource);
}

export function checkFipfopSourceCli(
  executable: string,
  directory: string,
  name: string,
  source: string,
): void {
  const file = join(directory, `${name}.basic.json`);
  const saved = join(directory, `${name}-copy.basic.json`);
  const preload = join(directory, `${name}-clock.ts`);
  const document = {
    format: 'basic-program',
    version: 1,
    ...fipfopRandomOptions,
    source,
  };
  writeFileSync(file, JSON.stringify(document));
  writeFileSync(preload, 'Math.random = () => 0;\n');
  const args = ['--preload', preload, executable];
  const input = fipfopRandomTurns.map(({answer}) => answer).join('\n') + '\n';

  const direct = runProcess({cwd: directory, args: [...args, file], input});
  assert.equal(direct.stderr, '');
  assert.equal(direct.stdout, fipfopRandomTranscript);

  const editor = runProcess({
    cwd: directory,
    args,
    input: `LOAD "${file}"\nSAVE "${saved}"\nNEW\nLOAD "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${fipfopRandomTranscript}>>> ${fipfopRandomTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
