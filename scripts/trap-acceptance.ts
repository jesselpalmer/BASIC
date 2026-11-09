import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/trap-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const trapOptions = {dialect: 'edusystem-30'} as const;
export const trapSource = readFileSync(
  new URL('./package/fixtures/classic/trap-mar75-text.bas', import.meta.url),
  'utf8',
);
export const trapAnswers = reference.answers;
export const trapNextRound = 'TRY AGAIN. \n\n\nGUESS # 1 ?';

export function assertTrapOutput(output: string): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), reference.outputSha256, output);
}

export async function runTrapAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicSyntaxError' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(trapSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(trapSource, trapOptions);
  assert.equal(program.source, trapSource);
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
    trapOptions,
  );
  const inputFailure = (code: string, label: number) => (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, code);
    assert.equal(error.diagnostic.label, label);
    return true;
  };
  answers = [...trapAnswers];
  await assert.rejects(
    basic.runAsync(program, {instructionLimit: 500}),
    inputFailure('INPUT_ENDED', 220),
  );
  assertTrapOutput(output);

  output = '';
  answers = ['0', '23,23'];
  await assert.rejects(
    basic.runAsync(undefined, {instructionLimit: 100}),
    inputFailure('INPUT_ENDED', 220),
  );
  assert.equal(
    output,
    `WANT INSTRUCTIONS (1 FOR YES)?\nGUESS # 1 ?YOU GOT IT!!!\n\n${trapNextRound}`,
  );

  output = '';
  answers = [...reference.inputProbe.answers];
  await assert.rejects(
    basic.runAsync(reference.inputProbe.source, {instructionLimit: 100}),
    inputFailure('INPUT_ENDED', 10),
  );
  assert.equal(output, reference.inputProbe.output);

  const scalarSource = '10 INPUT A\n20 PRINT A\n30 END';
  output = '';
  answers = ['1,2'];
  await basic.runAsync(scalarSource);
  answers = ['3'];
  await basic.runAsync();
  assert.equal(output, '? 1 \n? 3 \n');

  answers = ['0'.repeat(65_537)];
  await assert.rejects(basic.runAsync(), inputFailure('INPUT_LIMIT', 10));

  let requests = 0;
  let interruptedOutput = '';
  const waiting = Promise.withResolvers<void>();
  const remaining = Promise.withResolvers<string>();
  const interrupted = new api.Basic(
    {
      write: (text) => (interruptedOutput += text),
      readLine() {
        if (++requests === 1) return Promise.resolve('5');
        waiting.resolve();
        return remaining.promise;
      },
    },
    trapOptions,
  );
  const run = interrupted.runAsync('10 A=1\n20 B=2\n30 INPUT A,B\n40 END');
  const stopped = assert.rejects(run, {name: 'AbortError'});
  await waiting.promise;
  remaining.resolve('BAD,6');
  // Let the host read settle, then stop before the selected decoder resumes.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(interrupted.cancel().status, 'halted');
  await stopped;
  assert.equal(interruptedOutput, '');
  assert.deepEqual(interrupted.variables, [
    {name: 'A', value: 1},
    {name: 'B', value: 2},
  ]);

  for (const form of ['INPUT A,B,C', 'INPUT "N";A,B', 'INPUT A(1),B', 'INPUT A,B$']) {
    assert.throws(
      () => api.parseProgram(`10 END\n20 ${form}\n30 END`, trapOptions),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicSyntaxError);
        assert.equal(error.diagnostic.code, 'UNSUPPORTED_EDUSYSTEM30_FORM');
        assert.equal(error.diagnostic.label, 20);
        return true;
      },
    );
  }
  assert.throws(() => api.parseProgram('10 GOSUB 30\n20 END', trapOptions), /No line label 30/);
}
