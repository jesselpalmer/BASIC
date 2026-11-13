import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/craps-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const crapsOptions = {dialect: 'edusystem-30-mark'} as const;
export const crapsSource = readFileSync(
  new URL('./package/fixtures/classic/craps-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const crapsRuns = reference.runs;

export function assertCrapsOutput(output: string, run: (typeof crapsRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runCrapsAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(crapsSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(crapsSource, crapsOptions);
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
    crapsOptions,
  );
  basic.reset(program);
  for (const [index, run] of crapsRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 1000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1130);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertCrapsOutput(output, run);
  }
}
