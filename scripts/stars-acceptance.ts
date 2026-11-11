import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/stars-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const starsOptions = {dialect: 'edusystem-30'} as const;
export const starsSource = readFileSync(
  new URL('./package/fixtures/classic/stars-mar75-text.bas', import.meta.url),
  'utf8',
);
export const starsRounds = reference.rounds;
export const starsEntropy = reference.clockWord / 4096;
export const starsPrompt = 'YOUR GUESS?';

export function assertStarsOutput(output: string, round: (typeof starsRounds)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), round.outputSha256, output);
}

export async function runStarsAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(starsSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(starsSource, starsOptions);
  assert.equal(program.source, starsSource);

  let output = '';
  let answers: string[] = [];
  let entropyReads = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => {
        entropyReads++;
        return starsEntropy;
      },
    },
    starsOptions,
  );
  basic.reset(program);
  for (const round of starsRounds) {
    output = '';
    answers = [...round.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 400}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 360);
      return true;
    });
    assert.deepEqual(answers, []);
    assertStarsOutput(output, round);
  }
  assert.equal(entropyReads, starsRounds.length);
}
