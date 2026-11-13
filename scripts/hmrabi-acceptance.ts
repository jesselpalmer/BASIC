import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/hmrabi-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const hmrabiOptions = {dialect: 'edusystem-30'} as const;
export const hmrabiSource = readFileSync(
  new URL('./package/fixtures/classic/hmrabi-edusystem30.bas', import.meta.url),
  'utf8',
);
export const hmrabiRuns = reference.runs;

export function assertHmrabiOutput(output: string, run: (typeof hmrabiRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runHmrabiAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  const pinnedSource = readFileSync(
    new URL('./package/fixtures/classic/hmrabi.bas', import.meta.url),
  );
  assert.equal(createHash('sha256').update(pinnedSource).digest('hex'), reference.pinnedSha256);
  assert.equal(createHash('sha256').update(hmrabiSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(hmrabiSource, hmrabiOptions);
  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answer);
      },
      random() {
        seeds++;
        return clockWord / 4096;
      },
    },
    hmrabiOptions,
  );
  basic.reset(program);
  for (const [index, run] of hmrabiRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 2000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertHmrabiOutput(output, run);
  }
}
