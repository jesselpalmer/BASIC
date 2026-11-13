import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/rocksp-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const rockspOptions = {dialect: 'edusystem-30'} as const;
export const rockspSource = readFileSync(
  new URL('./package/fixtures/classic/rocksp-edusystem30.bas', import.meta.url),
  'utf8',
);
export const rockspRuns = reference.runs;

export function assertRockspOutput(output: string, run: (typeof rockspRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runRockspAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(rockspSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(rockspSource, rockspOptions);
  assert.equal(program.source, rockspSource);

  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        output += prompt;
        return Promise.resolve(answer);
      },
      random: () => clockWord / 4096,
    },
    rockspOptions,
  );
  basic.reset(program);
  for (const run of rockspRuns) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 1500});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 200);
    assert.deepEqual(answers, []);
    assertRockspOutput(output, run);
  }
}
