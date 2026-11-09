import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/letter-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const letterOptions = {dialect: 'edusystem-30'} as const;
export const letterSource = readFileSync(
  new URL('./package/fixtures/classic/letter-mar75-text.bas', import.meta.url),
  'utf8',
);
export const letterAnswers = reference.answers;
export const letterEntropy = reference.clockWord / 4096;
export const letterPrompt = 'WHAT IS YOUR GUESS?';

export function assertLetterOutput(output: string): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), reference.outputSha256, output);
}

export async function runLetterAcceptance(
  api: Pick<
    typeof PublicApi,
    'Basic' | 'BasicSyntaxError' | 'BasicRuntimeError' | 'parseProgram' | 'validateProgram'
  >,
): Promise<void> {
  assert.equal(createHash('sha256').update(letterSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(letterSource, letterOptions);
  assert.equal(program.source, letterSource);
  let output = '';
  let answers: string[] = [];
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '');
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => {
        seeds++;
        return letterEntropy;
      },
    },
    letterOptions,
  );
  const endsAtInput = (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, 'INPUT_ENDED');
    assert.equal(error.diagnostic.label, 430);
    return true;
  };
  answers = [...letterAnswers];
  await assert.rejects(basic.runAsync(program, {instructionLimit: 500}), endsAtInput);
  assertLetterOutput(output);
  assert.equal(seeds, 1);

  output = '';
  answers = [...letterAnswers];
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 500}), endsAtInput);
  assertLetterOutput(output);
  assert.equal(seeds, 2);

  output = '';
  answers = ['AB', 'é', '', 'a', 'Z', 'D'];
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 500}), endsAtInput);
  assert.equal(output.match(/Enter one ASCII character\./g)?.length, 2);
  assert.match(output, /TOO LOW\. TRY A HIGHER LETTER\./);
  assert.equal(output.match(/TOO HIGH\. TRY A LOWER LETTER\./g)?.length, 2);
  assert.match(output, /YOU GOT IT IN 4 GUESSES!!/);
  assert.throws(() => api.parseProgram(letterSource), api.BasicSyntaxError);
  for (const form of [
    'INPUT $A$',
    'PRINT CHR$(8)',
    'FOR I=1 TO 3 STEP 2',
    'RANDOMIZE 1',
    'PRINT "X":PRINT "Y"',
  ]) {
    assert.throws(
      () => api.parseProgram(`10 END\n20 ${form}\n30 END`, letterOptions),
      api.BasicSyntaxError,
    );
  }
  for (const form of ['RANDOMIZE', 'INPUT $A']) {
    const selected = api.parseProgram(`10 ${form}\n20 END`, letterOptions);
    assert.throws(
      () => api.validateProgram(selected.lines.map((line) => ({...line, dialect: 'native'}))),
      /require the EDUSYSTEM-30 profile/,
    );
  }
}
