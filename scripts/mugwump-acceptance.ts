import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/mugwump-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const mugwumpOptions = {dialect: 'edusystem-30'} as const;
export const mugwumpSource = readFileSync(
  new URL('./package/fixtures/classic/mugwump-mar75-text.bas', import.meta.url),
  'utf8',
);
export const mugwumpRuns = reference.runs;
export const mugwumpEntropy = reference.clockWord / 4096;
export const mugwumpPrompt = 'WHAT IS YOUR GUESS?';

export function assertMugwumpOutput(output: string, run: (typeof mugwumpRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runMugwumpAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(mugwumpSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(mugwumpSource, mugwumpOptions);
  assert.equal(program.source, mugwumpSource);

  let output = '';
  let answers: string[] = [];
  let randomizations = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => {
        randomizations++;
        return mugwumpEntropy;
      },
    },
    mugwumpOptions,
  );
  basic.reset(program);
  for (const [index, run] of mugwumpRuns.entries()) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 10000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 300);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.equal(randomizations, index + 1);
    assert.ok(output.endsWith(mugwumpPrompt));
    assertMugwumpOutput(output, run);
  }
}
