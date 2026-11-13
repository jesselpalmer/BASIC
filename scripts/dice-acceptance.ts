import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/dice-edusystem30-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const diceOptions = {dialect: 'edusystem-30-mark'} as const;
export const diceSource = readFileSync(
  new URL('./package/fixtures/classic/dice-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const diceRuns = reference.runs;
export const diceRollsPrompt = 'HOW MANY ROLLS?';
export const diceReplayPrompt = 'TRY AGAIN';

export async function runDiceAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(diceSource).digest('hex'), reference.fixtureSha256);
  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, /^\d+$/.test(answer) ? '?' : '');
        output += prompt;
        return Promise.resolve(answer);
      },
    },
    diceOptions,
  );
  basic.reset(api.parseProgram(diceSource, diceOptions));
  for (const run of diceRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 2000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 240);
    assert.deepEqual(answers, []);
    assert.equal(output, run.output, run.name);
  }
}
