import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  aceyduDefaultSource,
  aceyduOptions,
  aceyduSource,
  aceyduTerminalTranscript,
  aceyduTurns,
} from '../aceydu-acceptance.ts';
import {runProcess} from '../subprocess.ts';

export function checkAceyduCli(executable: string, directory: string): void {
  const file = join(directory, 'aceydu.basic.json');
  const saved = join(directory, 'aceydu-copy.basic.json');
  const defaultFile = join(directory, 'aceydu-default.basic.json');
  const preload = join(directory, 'aceydu-clock.ts');
  const document = {format: 'basic-program', version: 1, ...aceyduOptions, source: aceyduSource};
  writeFileSync(file, JSON.stringify(document));
  writeFileSync(defaultFile, JSON.stringify({...document, source: aceyduDefaultSource}));
  writeFileSync(preload, 'Math.random = () => 0;\n');
  const cli = ['--preload', preload, executable];
  const input = aceyduTurns.map(({answer}) => answer).join('\n') + '\n';
  for (const args of [
    [executable, defaultFile],
    [...cli, file],
  ]) {
    const result = runProcess({cwd: directory, args, input});
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, aceyduTerminalTranscript);
  }

  const editor = runProcess({
    cwd: directory,
    args: cli,
    input: `LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}RUN\n${input}EXIT\n`,
  });
  assert.equal(editor.stderr, '');
  assert.ok(
    editor.stdout.includes(`>>> ${aceyduTerminalTranscript}>>> ${aceyduTerminalTranscript}>>> `),
    editor.stdout,
  );
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
