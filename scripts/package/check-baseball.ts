import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  assertBaseballOutput,
  baseballAnswers,
  baseballCatalogPrompt,
  baseballMenuPrompt,
  baseballOptions,
  baseballPrograms,
  baseballSource,
} from '../baseball-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkBaseballCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'demon-edusystem30.basic.json');
  const saved = join(directory, 'demon-edusystem30-copy.basic.json');
  const chainDirectory = join(directory, 'omsi');
  const document = {
    format: 'basic-program',
    version: 1,
    ...baseballOptions,
    source: baseballSource,
  };
  writeFileSync(file, JSON.stringify(document));
  mkdirSync(chainDirectory);
  for (const [name, source] of baseballPrograms) {
    writeFileSync(join(chainDirectory, `${name.trimEnd()}.bas`), source);
  }

  const args = [executable, '--chain-dir', chainDirectory];
  const input = baseballAnswers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [...args, file], input, expectedStatus: 1});
  assert.match(direct.stderr, /^Line 170, column \d+: Input ended before a value was received\n$/);
  assertBaseballOutput(direct.stdout);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'fresh' | 'stopped-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args,
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}`);
      } else if (phase === 'play' && stdout.endsWith(baseballCatalogPrompt)) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'fresh';
        child.stdin.write('RUN\n');
      } else if (phase === 'fresh' && stdout.endsWith(baseballMenuPrompt)) {
        phase = 'stopped-again';
        child.kill('SIGINT');
      } else if (phase === 'stopped-again' && stdout.endsWith('\n>>> ')) {
        phase = 'exit';
        child.stdin.write('EXIT\n');
      }
    },
  });
  assert.equal(phase, 'exit', editor.stdout);
  assert.equal(editor.status, 0);
  assert.equal(editor.stderr, '');
  assert.ok(editor.stdout.includes(direct.stdout));
  assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
}
