import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  nicomaAnswers,
  nicomaFirstPrompt,
  nicomaOptions,
  nicomaOutput,
  nicomaSource,
  nicomaThinking,
} from '../nicoma-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkNicomaCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'nicoma-ma2.basic.json');
  const saved = join(directory, 'nicoma-ma2-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...nicomaOptions, source: nicomaSource};
  writeFileSync(file, JSON.stringify(document));
  const input = nicomaAnswers.join('\n') + '\n';
  const direct = runProcess({
    cwd: directory,
    args: [executable, file],
    input,
    expectedStatus: 1,
    timeout: 35_000,
  });
  assert.match(direct.stderr, /^Line 45, column \d+: Selected MA2 input ended\n$/);
  assert.equal(direct.stdout, nicomaOutput.piped);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'sleep' | 'stop' | 'replay' | 'stop-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    timeout: 35_000,
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'sleep';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n3\n0\n5\n`);
      } else if (phase === 'sleep' && stdout.endsWith(nicomaThinking)) {
        phase = 'stop';
        child.kill('SIGINT');
      } else if (phase === 'stop' && stdout.endsWith('\n>>> ')) {
        phase = 'replay';
        child.stdin.write(`LOAD "${saved}"\nRUN\n${input}`);
      } else if (phase === 'replay' && stdout.endsWith(nicomaOutput.piped)) {
        phase = 'stop-again';
        child.kill('SIGINT');
      } else if (phase === 'stop-again' && stdout.endsWith('\n>>> ')) {
        phase = 'exit';
        child.stdin.write('EXIT\n');
      }
    },
  });
  assert.equal(phase, 'exit', editor.stdout);
  assert.equal(editor.status, 0);
  assert.equal(editor.stderr, '');
  assert.ok(editor.stdout.includes(nicomaThinking + '\n>>> '));
  assert.ok(editor.stdout.includes(nicomaOutput.piped + '\n>>> '));
  assert.equal(editor.stdout.split(nicomaFirstPrompt + '? ').length - 1, 6);
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
