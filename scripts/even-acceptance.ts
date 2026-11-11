import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/even-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const evenOptions = {dialect: 'edusystem-30'} as const;
export const evenSource = readFileSync(
  new URL('./package/fixtures/classic/even-mar75-text.bas', import.meta.url),
  'utf8',
);
export const evenRuns = reference.runs;

export function assertEvenOutput(output: string, run: (typeof evenRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runEvenAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(evenSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(evenSource, evenOptions);
  assert.equal(program.source, evenSource);
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
    evenOptions,
  );
  basic.reset(program);
  for (const run of evenRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 2000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1230);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertEvenOutput(output, run);
  }
}
