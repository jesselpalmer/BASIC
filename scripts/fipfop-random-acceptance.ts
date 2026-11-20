import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/fipfop-randomized-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const fipfopRandomOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
export const fipfopRandomSource = readFileSync(
  new URL('./package/fixtures/classic/fipfop-random-ma2.bas', import.meta.url),
  'utf8',
);
export const fipfopRandomTranscript = reference.output;
const prompts = Array.from(
  fipfopRandomTranscript.matchAll(/(INPUT THE NUMBER|DO YOU WANT TO DO ANOTHER PUZZLE)\? /g),
);
assert.equal(prompts.length, reference.inputs.length);
export const fipfopRandomTurns = prompts.map((match, index) => ({
  // The source writes the instruction, followed by an unprompted INPUT.
  answer: reference.inputs[index],
  precedingOutput: match[1],
}));
const chunks = fipfopRandomTranscript.split(
  /(?<=INPUT THE NUMBER|DO YOU WANT TO DO ANOTHER PUZZLE)\? /g,
);
export const fipfopRandomBrowserOpening = chunks[0];
export const fipfopRandomBrowserTranscript = chunks
  .map((chunk, index) =>
    index < fipfopRandomTurns.length ? chunk + fipfopRandomTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runFipfopRandomAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(fipfopRandomSource).digest('hex'),
    reference.portableFixtureSha256,
  );
  const program = api.parseProgram(fipfopRandomSource, fipfopRandomOptions);
  assert.equal(program.source, fipfopRandomSource);
  let output = '';
  const turns: (typeof fipfopRandomTurns)[number][] = [];
  let randomizations = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      random() {
        randomizations++;
        return 0;
      },
      readLine(prompt) {
        const turn = turns.shift();
        assert.ok(turn, output);
        assert.equal(prompt, '');
        assert.ok(output.endsWith(turn.precedingOutput), output);
        output += '? ';
        return Promise.resolve(turn.answer);
      },
    },
    fipfopRandomOptions,
  );
  basic.reset(program);
  for (let run = 0; run < 2; run++) {
    turns.push(...fipfopRandomTurns);
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 780);
    assert.deepEqual(turns, []);
    assert.equal(output, fipfopRandomTranscript);
    output = '';
  }
  assert.equal(randomizations, 6);
}
