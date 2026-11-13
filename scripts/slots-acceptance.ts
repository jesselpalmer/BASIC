import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/slots-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const slotsOptions = {dialect: 'edusystem-30-mark'} as const;
export const slotsSource = readFileSync(
  new URL('./package/fixtures/classic/slots-edusystem30.bas', import.meta.url),
  'utf8',
);
export const slotsRuns = reference.runs;
export const slotsEntropy = reference.clockWord / 4096;

export function assertSlotsOutput(output: string, run: (typeof slotsRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runSlotsAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(slotsSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(slotsSource, slotsOptions);
  assert.equal(program.source, slotsSource);

  let output = '';
  let answers: string[] = [];
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, '');
        return Promise.resolve(answer);
      },
      random() {
        seeds++;
        return slotsEntropy;
      },
    },
    slotsOptions,
  );
  basic.reset(program);
  for (const [index, run] of slotsRuns.entries()) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 3000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 580);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertSlotsOutput(output, run);
  }
}
