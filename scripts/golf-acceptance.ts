import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/golf-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const golfOptions = {dialect: 'edusystem-30-mark'} as const;
export const golfSource = readFileSync(
  new URL('./package/fixtures/classic/golf-mar75-text.bas', import.meta.url),
  'utf8',
);
export const golfRuns = reference.runs;

export function assertGolfOutput(output: string, run: (typeof golfRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runGolfAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(golfSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(golfSource, golfOptions);
  assert.equal(program.source, golfSource);

  let output = '';
  let answers: string[] = [];
  let inputCount = 0;
  let clockWord = 0;
  let randomizations = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, inputCount++ === 0 ? '' : '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => {
        randomizations++;
        return clockWord / 4096;
      },
    },
    golfOptions,
  );
  basic.reset(program);
  for (const [index, run] of golfRuns.entries()) {
    output = '';
    answers = [...run.answers];
    inputCount = 0;
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1440);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(randomizations, index + 1);
    assertGolfOutput(output, run);
  }
}
