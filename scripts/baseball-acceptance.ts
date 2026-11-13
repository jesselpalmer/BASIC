import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import reference from '../docs/edusystem30-omsi-reference.json';
import type * as PublicApi from '../src/index.ts';

export const baseballOptions = {dialect: 'edusystem-30-mark'} as const;
export const baseballAnswers = reference.baseball.answers;
export const baseballMenuPrompt = "(OR TYPE 'LIST' FOR A LISTING) ?";
export const baseballTeamPrompt = '(YOUR NAME PLEASE) THE ';
export const baseballPlayPrompt = 'YOUR PLAY? ';
export const baseballCatalogPrompt = 'WHAT DEMONSTRATION WOULD YOU LIKE TO SEE? ';

const readFixture = (name: string) =>
  readFileSync(new URL(`../examples/omsi/${name}.bas`, import.meta.url), 'utf8');
export const baseballSource = readFixture('DEMON');
export const baseballPrograms = new Map([
  ['DEMON ', baseballSource],
  ['BASBAL', readFixture('BASBAL')],
  ['BASBL1', readFixture('BASBL1')],
]);

export function assertBaseballOutput(output: string): void {
  // The capture strips the operator's echoed lines and includes the monitor's RUN banner.
  // Only remove the corresponding input line endings from the portable transcript.
  const portable = output
    .replaceAll(`${baseballMenuPrompt}\n\n`, `${baseballMenuPrompt}\n`)
    .replaceAll(`${baseballTeamPrompt}\n`, baseballTeamPrompt)
    .replaceAll(`${baseballPlayPrompt}\n`, baseballPlayPrompt);
  const banner = '\f\n\nDEMON   EDUSYSTEM-30\n\n';
  assert.ok(reference.baseball.output.startsWith(banner));
  assert.equal(portable, reference.baseball.output.slice(banner.length));
}

export async function runBaseballAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  const program = api.parseProgram(baseballSource, baseballOptions);
  const loaded: string[] = [];
  let output = '';
  let answers = [...baseballAnswers];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '');
        return Promise.resolve(answers.shift() ?? null);
      },
      loadProgram(name) {
        loaded.push(name);
        return baseballPrograms.get(name) ?? null;
      },
    },
    baseballOptions,
  );
  const endedAtMenu = (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, 'INPUT_ENDED');
    assert.equal(error.diagnostic.label, 170);
    return true;
  };

  await assert.rejects(basic.runAsync(program, {instructionLimit: 15_000}), endedAtMenu);
  assert.deepEqual(answers, []);
  assert.deepEqual(loaded, ['BASBAL', 'BASBL1', 'DEMON ']);
  assertBaseballOutput(output);

  loaded.length = 0;
  output = '';
  answers = [...baseballAnswers];
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 15_000}), endedAtMenu);
  assert.deepEqual(answers, []);
  assert.deepEqual(loaded, ['BASBAL', 'BASBL1', 'DEMON ']);
  assertBaseballOutput(output);
}
