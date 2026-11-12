import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/gomoko-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const gomokoOptions = {dialect: 'edusystem-30'} as const;
export const gomokoSource = readFileSync(
  new URL('./package/fixtures/classic/gomoko-edusystem30-adapted.bas', import.meta.url),
  'utf8',
);
export const gomokoRuns = reference.runs;

export function assertGomokoOutput(output: string, run: (typeof gomokoRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runGomokoAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(gomokoSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(gomokoSource, gomokoOptions);
  assert.equal(program.source, gomokoSource);

  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        const answer = answers.shift();
        assert.notEqual(answer, undefined, 'Unexpected GOMOKO input request');
        return Promise.resolve(answer ?? null);
      },
    },
    gomokoOptions,
  );
  basic.reset(program);
  for (const run of gomokoRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertGomokoOutput(output, run);
  }
}
