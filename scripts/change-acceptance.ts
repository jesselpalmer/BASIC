import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/change-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const changeOptions = {dialect: 'edusystem-30'} as const;
export const changeSource = readFileSync(
  new URL('./package/fixtures/classic/change-mar75-text.bas', import.meta.url),
  'utf8',
);
export const changePrompt = 'COST OF ITEM?';

const firstReceiptEnd =
  reference.game.output.indexOf(changePrompt, reference.game.output.indexOf(changePrompt) + 1) +
  changePrompt.length;
export const changeRuns = [
  {answers: reference.game.sales.flat(), output: reference.game.output},
  {answers: reference.game.sales[0], output: reference.game.output.slice(0, firstReceiptEnd)},
] as const;

export async function runChangeAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(changeSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(changeSource, changeOptions);
  assert.equal(program.source, changeSource);

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
    changeOptions,
  );
  basic.reset(program);
  for (const run of changeRuns) {
    output = '';
    answers = [...run.answers];
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 1000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 10);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.equal(output, run.output);
  }
}
