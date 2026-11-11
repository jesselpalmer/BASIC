import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/batnum-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const batnumOptions = {dialect: 'edusystem-30'} as const;
export const batnumSource = readFileSync(
  new URL('./package/fixtures/classic/batnum-mar75-text.bas', import.meta.url),
  'utf8',
);
export const batnumRuns = reference.runs;
export const batnumPrompt = 'ENTER PILE SIZE:?';

export function assertBatnumOutput(output: string, run: (typeof batnumRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runBatnumAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(batnumSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(batnumSource, batnumOptions);
  assert.equal(program.source, batnumSource);

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
    batnumOptions,
  );
  basic.reset(program);
  for (const run of batnumRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 1500}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 340);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.ok(output.endsWith(batnumPrompt));
    assertBatnumOutput(output, run);
  }
}
