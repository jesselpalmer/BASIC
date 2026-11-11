import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/rocket-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const rocketOptions = {dialect: 'edusystem-30'} as const;
export const rocketSource = readFileSync(
  new URL('./package/fixtures/classic/rocket-mar75-text.bas', import.meta.url),
  'utf8',
);
export const rocketRuns = reference.runs;
export const rocketPrompt = ' 0             120  0        3600          16500        ?';

export function assertRocketOutput(output: string, run: (typeof rocketRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runRocketAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(rocketSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(rocketSource, rocketOptions);
  assert.equal(program.source, rocketSource);

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
    rocketOptions,
  );
  basic.reset(program);
  for (const run of rocketRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 5000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 21);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.ok(output.endsWith(rocketPrompt));
    assertRocketOutput(output, run);
  }
}
