import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/kinema-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const kinemaOptions = {dialect: 'edusystem-30'} as const;
export const kinemaSource = readFileSync(
  new URL('./package/fixtures/classic/kinema-edu30-adapted.bas', import.meta.url),
  'utf8',
);
export const kinemaRuns = reference.runs;
export const kinemaPrompt = 'HOW HIGH WILL IT GO (IN METERS)?';

export function assertKinemaOutput(output: string, run: (typeof kinemaRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runKinemaAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(kinemaSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(kinemaSource, kinemaOptions);
  assert.equal(program.source, kinemaSource);

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
    kinemaOptions,
  );
  basic.reset(program);
  for (const run of kinemaRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 5000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 500);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.ok(output.endsWith(kinemaPrompt));
    assertKinemaOutput(output, run);
  }
}
