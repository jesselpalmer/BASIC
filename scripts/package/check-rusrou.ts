import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {assertRusrouOutput, rusrouOptions, rusrouRuns, rusrouSource} from '../rusrou-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkRusrouCli(executable: string, directory: string): Promise<void> {
  const file = join(directory, 'rusrou.basic.json');
  const preload = join(directory, 'rusrou-clock.ts');
  const document = {format: 'basic-program', version: 1, ...rusrouOptions, source: rusrouSource};
  writeFileSync(file, JSON.stringify(document));
  for (const run of rusrouRuns) {
    const saved = join(directory, `rusrou-${run.clockWord}-copy.basic.json`);
    writeFileSync(preload, `Math.random = () => ${run.clockWord} / 4096;\n`);
    const args = ['--preload', preload, executable];
    const input = run.answers.join('\n') + '\n';
    const direct = runProcess({cwd: directory, args: [...args, file], input, expectedStatus: 1});
    assert.match(direct.stderr, /^Line 30, column \d+: Input ended before a value was received\n$/);
    assertRusrouOutput(direct.stdout, run);
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
