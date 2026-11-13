import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/train-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const trainOptions = {dialect: 'edusystem-30-mark'} as const;
export const trainSource = readFileSync(
  new URL('./package/fixtures/classic/train-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const trainRuns = reference.runs;

export function assertTrainOutput(output: string, run: (typeof trainRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runTrainAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(trainSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(trainSource, trainOptions);
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
        assert.equal(prompt, /^[YN]$/.test(answer) ? '' : '?');
        output += prompt;
        return Promise.resolve(answer);
      },
      random() {
        seeds++;
        return clockWord / 4096;
      },
    },
    trainOptions,
  );
  basic.reset(program);
  for (const [index, run] of trainRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 1000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertTrainOutput(output, run);
  }
}
