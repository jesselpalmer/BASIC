import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/chief-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const chiefOptions = {dialect: 'edusystem-30-mark'} as const;
export const chiefSource = readFileSync(
  new URL('./package/fixtures/classic/chief-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const chiefRuns = reference.runs;

export function assertChiefOutput(output: string, run: (typeof chiefRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runChiefAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(chiefSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(chiefSource, chiefOptions);
  assert.equal(program.source, chiefSource);

  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, /^[NY]$/.test(answer) ? '' : '?');
        output += prompt;
        return Promise.resolve(answer);
      },
    },
    chiefOptions,
  );
  basic.reset(program);
  for (const run of chiefRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 1000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 520);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertChiefOutput(output, run);
  }
}
