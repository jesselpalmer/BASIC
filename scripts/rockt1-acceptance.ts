import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/rockt1-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const rockt1Options = {dialect: 'edusystem-30-mark'} as const;
export const rockt1Source = readFileSync(
  new URL('./package/fixtures/classic/rockt1-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const rockt1Runs = reference.runs;

export function assertRockt1Output(output: string, run: (typeof rockt1Runs)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export function assertRockt1PaperOutput(output: string, run: (typeof rockt1Runs)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.paperOutputSha256, output);
}

export async function runRockt1Acceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(rockt1Source).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(rockt1Source, rockt1Options);
  assert.equal(program.source, rockt1Source);

  let output = '';
  let answers: string[] = [];
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
    },
    rockt1Options,
  );
  basic.reset(program);
  for (const run of rockt1Runs) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertRockt1Output(output, run);
  }
}
