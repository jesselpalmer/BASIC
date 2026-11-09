import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  altairOptions,
  assertLife2Transcript,
  life2Answers,
  life2FirstPrompt,
  life2Retries,
  life2Source,
} from '../life2-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkAltairCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'life2-altair.basic.json');
  const saved = join(directory, 'life2-altair-copy.basic.json');
  const document = {format: 'basic-program', version: 1, ...altairOptions, source: life2Source};
  writeFileSync(file, JSON.stringify(document));
  const input = life2Answers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [executable, file], input, expectedStatus: 1});
  assert.match(direct.stderr, /^Line 700, column \d+: Input ended before a value was received\n$/);
  assertLife2Transcript(direct.stdout);
  const retries = runProcess({
    cwd: directory,
    args: [executable, file],
    input: life2Retries.answers.join('\n') + '\n',
    expectedStatus: 1,
  });
  assert.equal(retries.stdout, life2Retries.output.join(''));
  assert.equal(retries.stderr, direct.stderr);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stop' | 'rerun' | 'stop-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args: [executable],
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}`);
      } else if (phase === 'play' && stdout.endsWith(direct.stdout)) {
        phase = 'stop';
        child.kill('SIGINT');
      } else if (phase === 'stop' && stdout.endsWith('\n>>> ')) {
        phase = 'rerun';
        child.stdin.write(`LOAD "${saved}"\nRUN\n`);
      } else if (phase === 'rerun' && stdout.endsWith(life2FirstPrompt)) {
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
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
