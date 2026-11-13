import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/nim-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const nimOptions = {dialect: 'edusystem-30-mark'} as const;
export const nimSource = readFileSync(
  new URL('./package/fixtures/classic/nim-edusystem30.bas', import.meta.url),
  'utf8',
);
export const nimRuns = reference.runs;

export function assertNimOutput(output: string, run: (typeof nimRuns)[number]): void {
  assert.equal(output, run.output, run.name);
}

export async function runNimAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  const pinned = readFileSync(new URL('./package/fixtures/classic/nim.bas', import.meta.url));
  assert.equal(createHash('sha256').update(pinned).digest('hex'), reference.pinnedSha256);
  assert.equal(createHash('sha256').update(nimSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(nimSource, nimOptions);
  assert.equal(program.source, nimSource);
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
    nimOptions,
  );
  basic.reset(program);
  for (const [index, run] of nimRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 30000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 290);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(seeds, index + 1);
    assertNimOutput(output, run);
  }
}
