import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/cube-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const cubeOptions = {dialect: 'edusystem-30'} as const;
export const cubeSource = readFileSync(
  new URL('./package/fixtures/classic/cube-edusystem30.bas', import.meta.url),
  'utf8',
);
export const cubeRuns = reference.runs;

export function assertCubeOutput(output: string, run: (typeof cubeRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runCubeAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(cubeSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(cubeSource, cubeOptions);
  let remaining: string[] = [];
  let output = '';
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(remaining.shift() ?? null);
      },
    },
    cubeOptions,
  );
  basic.reset(program);
  for (const run of cubeRuns) {
    remaining = [...run.answers];
    output = '';
    const result = await basic.runAsync(undefined, {instructionLimit: 4000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1640);
    assert.deepEqual(remaining, []);
    assertCubeOutput(output, run);
  }
}
