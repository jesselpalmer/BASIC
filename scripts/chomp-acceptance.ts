import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/chomp-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const chompOptions = {dialect: 'edusystem-30'} as const;
export const chompSource = readFileSync(
  new URL('./package/fixtures/classic/chomp-mar75-text.bas', import.meta.url),
  'utf8',
);
export const chompRuns = reference.runs;

export function assertChompOutput(output: string, run: (typeof chompRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runChompAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(chompSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(chompSource, chompOptions);
  assert.equal(program.source, chompSource);
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
    chompOptions,
  );
  basic.reset(program);
  for (const run of chompRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 15000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1060);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertChompOutput(output, run);
  }
}
