import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/reverse-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const reverseOptions = {dialect: 'edusystem-30-mark'} as const;
export const reverseSource = readFileSync(
  new URL('./package/fixtures/classic/reverse-mark-adapted.bas', import.meta.url),
  'utf8',
);
export const reverseRuns = reference.runs;

export function assertReverseOutput(output: string, run: (typeof reverseRuns)[number]): void {
  const boards = [...output.matchAll(/^ (?:[1-9] {2}){8}[1-9] $/gm)].map(([line]) =>
    line.trim().split(/ +/).map(Number),
  );
  assert.deepEqual(boards, run.boards);
  assert.equal(createHash('sha256').update(output).digest('hex'), run.outputSha256, output);
}

export async function runReverseAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(reverseSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(reverseSource, reverseOptions);
  assert.equal(program.source, reverseSource);

  let output = '';
  let answers: string[] = [];
  let clockWord = 0;
  let randomizations = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const answer = answers.shift();
        assert.ok(answer !== undefined, output);
        assert.equal(prompt, /^\d+$/.test(answer) ? '?' : '');
        output += prompt;
        return Promise.resolve(answer);
      },
      random() {
        randomizations++;
        return clockWord / 4096;
      },
    },
    reverseOptions,
  );
  basic.reset(program);
  for (const [index, run] of reverseRuns.entries()) {
    output = '';
    answers = [...run.answers];
    clockWord = run.clockWord;
    const result = await basic.runAsync(undefined, {instructionLimit: 15000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(randomizations, index + 1);
    assertReverseOutput(output, run);
  }
}
