import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/buzzwd-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

const options = {dialect: 'edusystem-30'} as const;
export const buzzwdSource = readFileSync(
  new URL('./package/fixtures/classic/buzzwd-edusystem30.bas', import.meta.url),
  'utf8',
);
export const buzzwdRuns = reference.runs;

export function assertBuzzwdOutput(output: string, run: (typeof buzzwdRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runBuzzwdAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(buzzwdSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(buzzwdSource, options);
  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    options,
  );
  basic.reset(program);
  for (const run of buzzwdRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 15000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1320);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertBuzzwdOutput(output, run);
  }
}
