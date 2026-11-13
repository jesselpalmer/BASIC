import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/even1-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const even1Options = {dialect: 'edusystem-30-mark'} as const;
export const even1Source = readFileSync(
  new URL('./package/fixtures/classic/even1-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const even1Runs = reference.runs;
export const even1Entropy = reference.clockWord / 4096;

export function assertEven1Output(output: string, run: (typeof even1Runs)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runEven1Acceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(even1Source).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(even1Source, even1Options);
  assert.equal(program.source, even1Source);

  let output = '';
  let answers: string[] = [];
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
        return even1Entropy;
      },
    },
    even1Options,
  );
  basic.reset(program);
  for (const [index, run] of even1Runs.entries()) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 3000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 570);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertEven1Output(output, run);
  }
}
