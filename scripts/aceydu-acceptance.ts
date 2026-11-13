import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/aceydu-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const aceyduOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url), 'utf8');
export const aceyduSource = fixture('aceydu-mar75-text.bas');
export const aceyduDefaultSource = fixture('aceydu-rsts-default.bas');
const {defaultStream} = reference;
const archive = defaultStream.output;
assert.ok(archive.endsWith('O. K. HOPE YOU HAD FUN!!\n\n'));

// The RSTS monitor writes one newline after the program's final PRINT.
const programOutput = archive.slice(0, -1);
const prompts = Array.from(
  programOutput.matchAll(/(WHAT IS YOUR BET|TRY AGAIN \(YES OR NO\))\? /g),
);
assert.equal(prompts.length, defaultStream.inputs.length);

export const aceyduTurns = prompts.map((match, index) => ({
  prompt: match[1],
  answer: defaultStream.inputs[index],
}));
export const aceyduTerminalTranscript = programOutput;

const browserChunks = programOutput.split(/(?:WHAT IS YOUR BET|TRY AGAIN \(YES OR NO\))\? /g);
export const aceyduBrowserOpening = browserChunks[0];
export const aceyduBrowserTranscript = browserChunks
  .map((chunk, index) =>
    index < aceyduTurns.length ? chunk + aceyduTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runAceyduAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(aceyduSource).digest('hex'),
    reference.reviewedFixtureSha256,
  );
  assert.equal(
    createHash('sha256').update(aceyduDefaultSource).digest('hex'),
    defaultStream.sourceSha256,
  );
  assert.equal(aceyduSource.replace(defaultStream.removedLine + '\n', ''), aceyduDefaultSource);
  let output = '';
  let randomizations = 0;
  const answers: (typeof aceyduTurns)[number][] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      random() {
        randomizations++;
        return 0;
      },
      readLine(prompt) {
        const turn = answers.shift();
        assert.ok(turn, output);
        assert.equal(prompt, turn.prompt);
        output += turn.prompt + '? ';
        return Promise.resolve(turn.answer);
      },
    },
    aceyduOptions,
  );
  for (const source of [aceyduDefaultSource, aceyduSource, undefined]) {
    answers.push(...aceyduTurns);
    const program = source === undefined ? undefined : api.parseProgram(source, aceyduOptions);
    if (program) assert.equal(program.source, source);
    const result = await basic.runAsync(program, {instructionLimit: 10_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 1050);
    assert.deepEqual(answers, []);
    assert.equal(output, aceyduTerminalTranscript);
    output = '';
  }
  assert.equal(randomizations, 2);
}
