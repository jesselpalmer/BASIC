import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runProcess, runWithOpenInput} from '../subprocess.ts';
import {
  assertZoopOutput,
  zoopAnswers,
  zoopMenuPrompt,
  zoopOptions,
  zoopPrograms,
  zoopSessions,
  zoopSource,
} from '../zoop-acceptance.ts';

export async function checkZoopCli(executable: string, directory: string): Promise<void> {
  const entry = join(directory, 'zoop-edusystem30.basic.json');
  const chainDirectory = join(directory, 'omsi-zoop');
  writeFileSync(
    entry,
    JSON.stringify({format: 'basic-program', version: 1, ...zoopOptions, source: zoopSource}),
  );
  mkdirSync(chainDirectory);
  for (const [name, source] of zoopPrograms) {
    writeFileSync(join(chainDirectory, `${name.trimEnd()}.bas`), source);
  }

  const args = [executable, '--chain-dir', chainDirectory];
  const session = zoopSessions[0];
  assert.equal(session.entry, 'ZOOP');
  const input = zoopAnswers(session).join('\n') + '\n';
  const direct = runProcess({cwd: directory, args: [...args, entry], input, expectedStatus: 1});
  assert.match(direct.stderr, /^Line 170, column \d+: Input ended before a value was received\n$/);
  assertZoopOutput(direct.stdout, session);

  if (process.platform === 'win32') return;
  let phase: 'start' | 'run' | 'stop' | 'rerun' | 'stop-again' | 'exit' = 'start';
  const editor = await runWithOpenInput({
    cwd: directory,
    args,
    onOutput(stdout, child) {
      if (phase === 'start' && stdout.endsWith('>>> ')) {
        phase = 'run';
        child.stdin.write(`LOAD "${entry}"\nRUN\n${input}`);
      } else if (phase === 'run' && stdout.endsWith(zoopMenuPrompt)) {
        phase = 'stop';
        child.kill('SIGINT');
      } else if (phase === 'stop' && stdout.endsWith('\n>>> ')) {
        phase = 'rerun';
        child.stdin.write('RUN\n');
      } else if (phase === 'rerun' && stdout.endsWith(session.start)) {
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
  assert.ok(editor.stdout.includes(direct.stdout));
}
