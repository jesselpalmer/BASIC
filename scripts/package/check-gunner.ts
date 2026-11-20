import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  gunnerOptions,
  gunnerAnswers,
  gunnerTerminalTranscript,
  gunnerSource,
} from '../gunner-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkGunnerCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'gunner.basic.json');
  const preload = join(directory, 'gunner-clock.ts');
  const document = {format: 'basic-program', version: 1, ...gunnerOptions, source: gunnerSource};
  writeFileSync(file, JSON.stringify(document));
  for (const run of [{answers: gunnerAnswers, clockWord: 0}]) {
    const saved = join(directory, `gunner-${run.clockWord}-copy.basic.json`);
    writeFileSync(preload, `Math.random = () => 0;\n`);
    const args = ['--preload', preload, executable];
    const input = run.answers.join('\n') + '\n';
    const direct = runProcess({cwd: directory, args: [...args, file], input, expectedStatus: 1});
    assert.match(direct.stderr, /^Line 410, column \d+: Selected MA2 input ended\n$/);
    assert.equal(direct.stdout, gunnerTerminalTranscript);
    if (process.platform === 'win32') continue;
    let phase: 'start' | 'play' | 'stopped' | 'fresh' | 'stopped-again' | 'exit' = 'start';
    const editor = await runWithOpenInput({
      cwd: directory,
      args,
      onOutput(stdout, child) {
        if (phase === 'start' && stdout.endsWith('>>> ')) {
          phase = 'play';
          child.stdin.write(`LOAD "${file}"\nSAVE "${saved}"\nRUN\n${input}`);
        } else if (phase === 'play' && stdout.endsWith(direct.stdout)) {
          phase = 'stopped';
          child.kill('SIGINT');
        } else if (phase === 'stopped' && stdout.endsWith('\n>>> ')) {
          phase = 'fresh';
          child.stdin.write(`LOAD "${saved}"\nRUN\n${input}`);
        } else if (phase === 'fresh' && stdout.endsWith(direct.stdout)) {
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
    assert.deepEqual(JSON.parse(readFileSync(saved, 'utf8')), document);
  }
}
