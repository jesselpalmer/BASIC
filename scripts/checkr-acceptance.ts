import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/checkr-complete-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const checkrOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url));
export const checkrSource = fixture('checkr-mar75-text.bas').toString('utf8');
export const checkrAnswers = reference.completeGame.inputs;
export const checkrTerminalTranscript = reference.completeGame.output;
const browserChunks = checkrTerminalTranscript.split('? ');
assert.equal(browserChunks.length, checkrAnswers.length + 1);
export const checkrBrowserOpening = browserChunks[0];
export const checkrBrowserTranscript = browserChunks
  .map((chunk, index) =>
    index < checkrAnswers.length ? chunk + checkrAnswers[index] + '\n' : chunk,
  )
  .join('');

export async function runCheckrAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(fixture('checkr.bas')).digest('hex'),
    reference.pinnedFixtureSha256,
  );
  assert.equal(
    createHash('sha256').update(fixture('checkr-mar75-text.bas')).digest('hex'),
    reference.reviewedFixtureSha256,
  );
  const program = api.parseProgram(checkrSource, checkrOptions);
  assert.equal(program.source, checkrSource);
  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '');
        const answer = answers.shift();
        assert.notEqual(answer, undefined, output);
        output += '? ';
        return Promise.resolve(answer!);
      },
    },
    checkrOptions,
  );
  for (const source of [program, undefined]) {
    answers = [...checkrAnswers];
    const result = await basic.runAsync(source, {instructionLimit: 1_000_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 19200);
    assert.deepEqual(answers, []);
    assert.equal(output, checkrTerminalTranscript);
    output = '';
  }
}
