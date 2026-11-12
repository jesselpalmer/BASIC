import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/bounce-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const bounceOptions = {dialect: 'edusystem-30'} as const;
export const bounceSource = readFileSync(
  new URL('./package/fixtures/classic/bounce-mar75-text.bas', import.meta.url),
  'utf8',
);
export const bounceRuns = reference.runs;
export const bouncePrompt = 'TIME INCREMENT (SEC)?';

export function assertBounceOutput(output: string, run: (typeof bounceRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export function assertBouncePaperOutput(output: string, run: (typeof bounceRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.paperOutputSha256, output);
}

export async function runBounceAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(bounceSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(bounceSource, bounceOptions);
  assert.equal(program.source, bounceSource);

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
    bounceOptions,
  );
  basic.reset(program);
  for (const run of bounceRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 15000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 136);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.ok(output.endsWith(bouncePrompt));
    assertBounceOutput(output, run);
  }
}
