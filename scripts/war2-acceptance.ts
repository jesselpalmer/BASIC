import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/war2-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const war2Options = {dialect: 'edusystem-30'} as const;
export const war2Source = readFileSync(
  new URL('./package/fixtures/classic/war2-edusystem30-adapted.bas', import.meta.url),
  'utf8',
);
export const war2Runs = reference.runs;

export async function runWar2Acceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(war2Source).digest('hex'), reference.fixtureSha256);
  let answers: string[] = [];
  let output = '';
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    war2Options,
  );
  basic.reset(api.parseProgram(war2Source, war2Options));
  for (const run of war2Runs) {
    answers = [...run.answers];
    output = '';
    const result = await basic.runAsync(undefined, {instructionLimit: 2000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 2020);
    assert.deepEqual(answers, []);
    assert.equal(output, run.output, run.name);
  }
}
