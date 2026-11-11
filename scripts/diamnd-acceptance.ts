import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/diamnd-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const diamndOptions = {dialect: 'edusystem-30'} as const;
export const diamndSource = readFileSync(
  new URL('./package/fixtures/classic/diamnd-mar75-text.bas', import.meta.url),
  'utf8',
);
export const diamndRuns = reference.runs;

export function assertDiamndOutput(output: string, run: (typeof diamndRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
  assert.equal(output.split('\n').slice(3, -1).length, run.rowCount);
}

export async function runDiamndAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(diamndSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(diamndSource, diamndOptions);
  assert.equal(program.source, diamndSource);

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
    diamndOptions,
  );
  basic.reset(program);
  for (const run of diamndRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 100_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 99);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertDiamndOutput(output, run);
  }
}
