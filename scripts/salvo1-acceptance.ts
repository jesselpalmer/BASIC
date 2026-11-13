import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/salvo1-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const salvo1Options = {dialect: 'edusystem-30'} as const;
export const salvo1Source = readFileSync(
  new URL('./package/fixtures/classic/salvo1-edusystem30.bas', import.meta.url),
  'utf8',
);
export const salvo1Runs = reference.runs;

export function assertSalvo1Output(output: string, run: (typeof salvo1Runs)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runSalvo1Acceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  const pinnedSource = readFileSync(
    new URL('./package/fixtures/classic/salvo1.bas', import.meta.url),
  );
  assert.equal(createHash('sha256').update(pinnedSource).digest('hex'), reference.pinnedSha256);
  assert.equal(createHash('sha256').update(salvo1Source).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(salvo1Source, salvo1Options);
  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answer);
      },
      random() {
        seeds++;
        return clockWord / 4096;
      },
    },
    salvo1Options,
  );
  basic.reset(program);
  for (const [index, run] of salvo1Runs.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 1500});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1235);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertSalvo1Output(output, run);
  }
}
