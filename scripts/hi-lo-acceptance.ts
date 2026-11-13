import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/hi-lo-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const hiLoOptions = {dialect: 'edusystem-30-mark'} as const;
export const hiLoSource = readFileSync(
  new URL('./package/fixtures/classic/hi-lo-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const hiLoRuns = reference.runs;

export function assertHiLoOutput(output: string, run: (typeof hiLoRuns)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runHiLoAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(hiLoSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(hiLoSource, hiLoOptions);
  assert.equal(program.source, hiLoSource);

  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, /^[YN]$/.test(answer) ? '' : '?');
        output += prompt;
        return Promise.resolve(answer);
      },
      random() {
        seeds++;
        return clockWord / 4096;
      },
    },
    hiLoOptions,
  );
  basic.reset(program);
  for (const [index, run] of hiLoRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 3000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 390);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertHiLoOutput(output, run);
  }
}
