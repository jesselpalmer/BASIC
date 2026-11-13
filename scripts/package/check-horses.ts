import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  assertHorsesOutput,
  horsesMenuPrompt,
  horsesOptions,
  horsesPrograms,
  horsesSessions,
} from '../horses-acceptance.ts';
import {runProcess, runWithOpenInput} from '../subprocess.ts';

export async function checkHorsesCli(executable: string, directory: string): Promise<void> {
  const chainDirectory = join(directory, 'omsi-horses');
  mkdirSync(chainDirectory);
  for (const [name, source] of horsesPrograms) {
    writeFileSync(join(chainDirectory, `${name.trimEnd()}.bas`), source);
  }
  const args = [executable, '--chain-dir', chainDirectory];
  for (const session of horsesSessions) {
    const entry = join(directory, `horses-${session.entry.toLowerCase()}.basic.json`);
    const programName = session.entry === 'DEMON' ? 'DEMON ' : session.entry;
    const source = horsesPrograms.get(programName);
    assert.ok(source);
    writeFileSync(
      entry,
      JSON.stringify({format: 'basic-program', version: 1, ...horsesOptions, source}),
    );
    const input = session.inputs.map(({answer}) => answer).join('\n') + '\n';
    const direct = runProcess({cwd: directory, args: [...args, entry], input, expectedStatus: 1});
    assert.match(
      direct.stderr,
      /^Line 170, column \d+: Input ended before a value was received\n$/,
    );
    assertHorsesOutput(direct.stdout, session);

    if (session.entry !== 'HORSES' || process.platform === 'win32') continue;
    let phase: 'start' | 'play' | 'stopped' | 'exit' = 'start';
    const editor = await runWithOpenInput({
      cwd: directory,
      args,
      onOutput(stdout, child) {
        if (phase === 'start' && stdout.endsWith('>>> ')) {
          phase = 'play';
          child.stdin.write(`LOAD "${entry}"\nRUN\n${input}`);
        } else if (phase === 'play' && stdout.endsWith(horsesMenuPrompt)) {
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
}
