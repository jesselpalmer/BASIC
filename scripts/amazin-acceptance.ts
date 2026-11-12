import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/amazin-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const amazinOptions = {dialect: 'edusystem-30'} as const;
export const amazinSource = readFileSync(
  new URL('./package/fixtures/classic/amazin-edu30-adapted.bas', import.meta.url),
  'utf8',
);
export const amazinRuns = reference.runs;
export const amazinPrompt = 'WHAT ARE YOUR WIDTH AND LENGTH?\n?';

export function assertAmazinOutput(output: string, run: (typeof amazinRuns)[number]): void {
  assert.deepEqual(output.trimEnd().split('\n').slice(-run.rows.length), run.rows);
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runAmazinAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(amazinSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(amazinSource, amazinOptions);
  assert.equal(program.source, amazinSource);

  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let randomizations = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random() {
        randomizations++;
        return clockWord / 4096;
      },
    },
    amazinOptions,
  );
  basic.reset(program);
  for (const [index, run] of amazinRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 15000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1073);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(randomizations, index + 1);
    assertAmazinOutput(output, run);
  }
}
