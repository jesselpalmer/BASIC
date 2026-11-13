import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/fipfop-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const fipfopOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
export const fipfopSource = readFileSync(
  new URL('./package/fixtures/classic/fipfop-ma2-fixed-q.bas', import.meta.url),
  'utf8',
);
export const fipfopTranscript = reference.portableReplay.output;
const prompts = Array.from(
  fipfopTranscript.matchAll(/(INPUT THE NUMBER|DO YOU WANT TO DO ANOTHER PUZZLE)\? /g),
);
assert.equal(prompts.length, reference.portableReplay.inputs.length);
export const fipfopTurns = prompts.map((match, index) => ({
  // The source writes the instruction, followed by an unprompted INPUT.
  answer: reference.portableReplay.inputs[index],
  precedingOutput: match[1],
}));
const chunks = fipfopTranscript.split(/(?<=INPUT THE NUMBER|DO YOU WANT TO DO ANOTHER PUZZLE)\? /g);
export const fipfopBrowserOpening = chunks[0];
export const fipfopBrowserTranscript = chunks
  .map((chunk, index) =>
    index < fipfopTurns.length ? chunk + fipfopTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runFipfopAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(fipfopSource).digest('hex'),
    reference.adaptedFixtureSha256,
  );
  const program = api.parseProgram(fipfopSource, fipfopOptions);
  assert.equal(program.source, fipfopSource);
  let output = '';
  const turns: (typeof fipfopTurns)[number][] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        const turn = turns.shift();
        assert.ok(turn, output);
        assert.equal(prompt, '');
        assert.ok(output.endsWith(turn.precedingOutput), output);
        output += '? ';
        return Promise.resolve(turn.answer);
      },
    },
    fipfopOptions,
  );
  basic.reset(program);
  for (let run = 0; run < 2; run++) {
    turns.push(...fipfopTurns);
    const result = await basic.runAsync(undefined, {instructionLimit: 10000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 780);
    assert.deepEqual(turns, []);
    assert.equal(output, fipfopTranscript);
    output = '';
  }
}
