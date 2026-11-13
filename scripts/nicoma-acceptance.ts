import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/nicoma-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

type Api = Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>;

export const nicomaOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
export const nicomaSource = readFileSync(
  new URL('./package/fixtures/classic/nicoma-mar75-text.bas', import.meta.url),
  'utf8',
);
export const nicomaFirstPrompt = 'YOUR NUMBER DIVIDED BY 3 HAS A REMAINDER OF';
export const nicomaThinking = 'LET ME THINK A MOMENT....\n';
const inputLine = /^(YOUR NUMBER (?:DIVIDED BY [357] HAS A REMAINDER OF|WAS \d+ , RIGHT))\? (.*)$/;
const archive = reference.transcript.slice(0, -3);
assert.equal(archive.at(-1), nicomaFirstPrompt + '? ^C');
const inputReplies = archive.flatMap((line) => {
  const match = inputLine.exec(line);
  return match && match[2] !== '^C' ? [match[2]] : [];
});
export const nicomaAnswers = Object.freeze(inputReplies);

export const nicomaOutput = Object.freeze({
  echo: archive.join('\n').replace(/\^C$/, ''),
  piped: archive
    .map((line) => {
      const match = inputLine.exec(line);
      return match ? match[1] + '? ' : line + '\n';
    })
    .join(''),
  browser: archive
    .map((line) => {
      const match = inputLine.exec(line);
      return match ? match[1] + (match[2] === '^C' ? '' : match[2] + '\n') : line + '\n';
    })
    .join(''),
});

export async function runNicomaAcceptance(api: Api): Promise<void> {
  assert.equal(createHash('sha256').update(nicomaSource).digest('hex'), reference.sourceSha256);
  const program = api.parseProgram(nicomaSource, nicomaOptions);
  assert.equal(program.source, nicomaSource);
  const remaining = [...nicomaAnswers];
  let output = '';
  const waits: number[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '');
        const reply = remaining.shift();
        output += reply === undefined ? '? ' : '? ' + reply + '\n';
        return Promise.resolve(reply ?? null);
      },
      wait(milliseconds) {
        waits.push(milliseconds);
        return Promise.resolve();
      },
    },
    nicomaOptions,
  );
  const endedAtNextRound = (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, 'INPUT_ENDED');
    assert.equal(error.diagnostic.label, 45);
    return true;
  };
  await assert.rejects(basic.runAsync(program, {instructionLimit: 250}), endedAtNextRound);
  assert.equal(remaining.length, 0);
  assert.deepEqual(waits, [5000, 5000, 5000, 5000]);
  assert.equal(output, nicomaOutput.echo);

  // A fresh run starts at the title and can stop at the first request.
  output = '';
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 250}), endedAtNextRound);
  assert.equal(output, nicomaOutput.echo.slice(0, nicomaOutput.echo.indexOf('? ') + 2));
}
