import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/blkjak-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const blkjakOptions = {dialect: 'edusystem-30-mark'} as const;
export const blkjakSource = readFileSync(
  new URL('./package/fixtures/classic/blkjak-mar75-text.bas', import.meta.url),
  'utf8',
);
export const blkjakRuns = reference.runs;
export const blkjakEntropy = reference.clockWord / 4096;

export function assertBlkjakOutput(output: string, run: (typeof blkjakRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runBlkjakAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(blkjakSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(blkjakSource, blkjakOptions);
  assert.equal(program.source, blkjakSource);

  let output = '';
  let answers: string[] = [];
  let seeds = 0;
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
      random() {
        seeds++;
        return blkjakEntropy;
      },
    },
    blkjakOptions,
  );
  basic.reset(program);
  for (const [index, run] of blkjakRuns.entries()) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 2000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertBlkjakOutput(output, run);
  }
}
