import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sample from './package/fixtures/classic/life2-sample.json' with {type: 'json'};
import reference from '../docs/life2-altair-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

type Api = Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>;

export const altairOptions = {dialect: 'altair-8k-4.0'} as const;
export const life2Source = readFileSync(
  new URL('./package/fixtures/classic/life2-mar75-reviewed.bas', import.meta.url),
  'utf8',
);
export const life2Answers = [
  ...sample.opening.flat(),
  ...sample.turns.flat(),
  ...reference.drawAnswers,
];
export const life2Retries = reference.coordinateRetries;
export const life2FirstPrompt = life2Retries.output[0];

function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function assertLife2Transcript(text: string, echo = false): void {
  assert.equal(
    digest(text),
    echo ? reference.transcriptSha256 : reference.outputAndPromptsSha256,
    text,
  );
}

export async function runAltairLife2Acceptance(api: Api): Promise<void> {
  assert.equal(digest(life2Source), reference.sourceSha256);
  const program = api.parseProgram(life2Source, altairOptions);
  assert.equal(program.source, life2Source);
  assert.equal(program.lines.length, 79);
  assert.ok(program.lines.every(({dialect}) => dialect === altairOptions.dialect));

  let output = '';
  let answers = [...life2Answers];
  const basic = new api.Basic(
    {
      write: (text) => {
        output += text;
      },
      readLine: (prompt) => {
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    altairOptions,
  );
  const endsAtInput = (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, 'INPUT_ENDED');
    assert.equal(error.diagnostic.label, 700);
    return true;
  };
  await assert.rejects(basic.runAsync(program, {instructionLimit: 20_000}), endsAtInput);
  assertLife2Transcript(output);
  assert.throws(() => basic.reset({...program, source: undefined}), /requires exact source/);
  assert.throws(
    () => basic.reset({...program, source: life2Source.replace('U.B LIFE', 'U.B. LIFE')}),
    /disagrees with its source/,
  );
  assert.throws(() => new api.Basic().reset(program), TypeError);
  assert.throws(() => basic.readLine('10 END'), /complete source program/);

  output = '';
  answers = [...reference.coordinateRetries.answers];
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 200}), endsAtInput);
  assert.equal(output, reference.coordinateRetries.output.join(''));
}
