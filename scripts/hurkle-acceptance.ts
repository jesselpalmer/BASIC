import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/hurkle-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const hurkleOptions = {dialect: 'edusystem-30'} as const;
export const hurkleSource = readFileSync(
  new URL('./package/fixtures/classic/hurkle-mar75-text.bas', import.meta.url),
  'utf8',
);
export const hurkleRounds = reference.rounds;
export const hurkleEntropy = reference.clockWord / 4096;
export const hurklePrompt = 'GUESS # 1 ?';

export function assertHurkleOutput(output: string, round: (typeof hurkleRounds)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), round.outputSha256, output);
}

export async function runHurkleAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(hurkleSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(hurkleSource, hurkleOptions);
  assert.equal(program.source, hurkleSource);

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
        return hurkleEntropy;
      },
    },
    hurkleOptions,
  );
  basic.reset(program);
  for (const round of hurkleRounds) {
    output = '';
    answers = [...round.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 700}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 330);
      return true;
    });
    assert.deepEqual(answers, []);
    assertHurkleOutput(output, round);
  }
  assert.equal(entropyReads, hurkleRounds.length);
}
