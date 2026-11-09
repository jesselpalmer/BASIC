import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/mathd-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const mathdOptions = {dialect: 'edusystem-30'} as const;
export const mathdSource = readFileSync(
  new URL('./package/fixtures/classic/mathd-mar75-text.bas', import.meta.url),
  'utf8',
);
export const mathdPrompt = '       = ?';
export const mathdAnswers = reference.answers;
export const mathdEntropy = reference.clockWords.map((word) => word / 4096);

export function assertMathdOutput(output: string): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), reference.outputSha256, output);
}

export async function runMathdAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(mathdSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(mathdSource, mathdOptions);
  assert.equal(program.source, mathdSource);
  let output = '';
  let answers: string[] = [];
  let randomIndex = 0;
  const write = (text: string) => (output += text);
  const basic = new api.Basic(
    {
      write,
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => mathdEntropy[randomIndex++],
    },
    mathdOptions,
  );
  basic.reset(program);
  for (let run = 0; run < 2; run++) {
    output = '';
    answers = [...mathdAnswers];
    randomIndex = 0;
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 500}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 520);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.equal(randomIndex, mathdEntropy.length);
    assertMathdOutput(output);
  }

  output = '';
  basic.run(reference.scalarProbe.source);
  assert.equal(output, reference.scalarProbe.output);
  assert.throws(() => new api.Basic().run('10 PRINT N'), /Undefined variable N/);
}
