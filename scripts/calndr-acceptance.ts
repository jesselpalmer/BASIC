import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/calndr-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

const options = {dialect: 'edusystem-30'} as const;
export const calndrSource = readFileSync(
  new URL('./package/fixtures/classic/calndr-edusystem30.bas', import.meta.url),
  'utf8',
);
export const calndrRuns = reference.runs;

export function calndrProgram(run: (typeof calndrRuns)[number]): string {
  return run.edits.reduce((source, [original, replacement]) => {
    assert.ok(source.includes(original), original);
    return source.replace(original, replacement);
  }, calndrSource);
}

export function assertCalndrOutput(output: string, run: (typeof calndrRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runCalndrAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(calndrSource).digest('hex'), reference.fixtureSha256);
  let output = '';
  const basic = new api.Basic({write: (text) => (output += text)}, options);
  for (const run of calndrRuns) {
    const source = calndrProgram(run);
    const program = api.parseProgram(source, options);
    basic.reset(program);
    for (let repeat = 0; repeat < 2; repeat++) {
      output = '';
      const result = await basic.runAsync(undefined, {instructionLimit: 30000});
      assert.equal(result.status, 'halted');
      assert.equal(result.currentLocation?.label, 640);
      assertCalndrOutput(output, run);
    }
  }
}
