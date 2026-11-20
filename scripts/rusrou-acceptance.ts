import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/rusrou-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const rusrouOptions = {dialect: 'edusystem-30'} as const;
export const rusrouSource = readFileSync(
  new URL('./package/fixtures/classic/rusrou-edusystem30.bas', import.meta.url),
  'utf8',
);
export const rusrouRuns = reference.runs;

export function assertRusrouOutput(output: string, run: (typeof rusrouRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runRusrouAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  const pinned = readFileSync(new URL('./package/fixtures/classic/rusrou.bas', import.meta.url));
  assert.equal(createHash('sha256').update(pinned).digest('hex'), reference.pinnedSha256);
  assert.equal(createHash('sha256').update(rusrouSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(rusrouSource, rusrouOptions);
  assert.equal(program.source, rusrouSource);
  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random() {
        seeds++;
        return clockWord / 4096;
      },
    },
    rusrouOptions,
  );
  basic.reset(program);
  for (const [index, run] of rusrouRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 3000}), (error) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 30);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertRusrouOutput(output, run);
  }
}
