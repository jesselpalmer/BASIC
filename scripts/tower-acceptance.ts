import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/tower-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const towerOptions = {dialect: 'edusystem-30-mark'} as const;
export const towerSource = readFileSync(
  new URL('./package/fixtures/classic/tower-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const towerRuns = reference.runs;

export function assertTowerOutput(output: string, run: (typeof towerRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runTowerAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(towerSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(towerSource, towerOptions);
  assert.equal(program.source, towerSource);

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
    towerOptions,
  );
  basic.reset(program);
  for (const run of towerRuns) {
    output = '';
    answers = [...run.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, run.haltLabel);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertTowerOutput(output, run);
  }
}
