import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/guess-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const guessOptions = {dialect: 'edusystem-30'} as const;
export const guessSource = readFileSync(
  new URL('./package/fixtures/classic/guess-edusystem30.bas', import.meta.url),
  'utf8',
);
export const guessRuns = reference.runs;

export function assertGuessOutput(output: string, run: (typeof guessRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runGuessAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(guessSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(guessSource, guessOptions);
  assert.equal(program.source, guessSource);

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
    guessOptions,
  );
  basic.reset(program);
  for (const run of guessRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 1000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 20);
      return true;
    });
    assert.deepEqual(answers, []);
    assertGuessOutput(output, run);
  }
}
