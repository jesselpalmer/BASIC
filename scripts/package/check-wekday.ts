import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runProcess, runWithOpenInput} from '../subprocess.ts';
import {
  assertWekdayOutput,
  wekdayMenuPrompt,
  wekdayOptions,
  wekdayPrograms,
  wekdaySessions,
  wekdaySource,
} from '../wekday-acceptance.ts';

export async function checkWekdayCli(executable: string, directory: string): Promise<void> {
  const entry = join(directory, 'wekday-edusystem30.basic.json');
  const chainDirectory = join(directory, 'omsi-wekday');
  writeFileSync(
    entry,
    JSON.stringify({format: 'basic-program', version: 1, ...wekdayOptions, source: wekdaySource}),
  );
  mkdirSync(chainDirectory);
  for (const [name, source] of wekdayPrograms) {
    writeFileSync(join(chainDirectory, `${name.trimEnd()}.bas`), source);
  }
  const args = [executable, '--chain-dir', chainDirectory];
  const session = wekdaySessions[0];
  assert.equal(session.entry, 'WEKDAY');
  const input = session.answers.join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [...args, entry], input, expectedStatus: 1});
  assert.match(direct.stderr, /^Line 170, column \d+: Input ended before a value was received\n$/);
  assertWekdayOutput(direct.stdout, session);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'play' | 'stopped' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args,
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'play';
        child.stdin.write(`LOAD "${entry}"\nRUN\n${input}`);
      } else if (phase === 'play' && stdout.endsWith(wekdayMenuPrompt)) {
        phase = 'stopped';
        child.kill('SIGINT');
      } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
        phase = 'exit';
        child.stdin.write('EXIT\n');
      }
    },
  });
  assert.equal(phase, 'exit', editor.stdout);
  assert.equal(editor.status, 0);
  assert.equal(editor.stderr, '');
  assert.ok(editor.stdout.includes(direct.stdout));
}
