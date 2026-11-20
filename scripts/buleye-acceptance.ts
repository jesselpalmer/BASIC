import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/buleye-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const buleyeOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url));
export const buleyeSource = fixture('buleye-ma2.bas').toString('utf8');
export const buleyeTerminalTranscript = reference.output;
export const buleyeTurns = reference.turns;
const terminalPrompts = /(?:HOW MANY PLAYERS)?\? /g;
const browserChunks = buleyeTerminalTranscript.split(terminalPrompts);
assert.equal(browserChunks.length, buleyeTurns.length + 1);
export const buleyeBrowserOpening = browserChunks[0];
export const buleyeBrowserTranscript = browserChunks
  .map((chunk, index) =>
    index < buleyeTurns.length ? chunk + buleyeTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runBuleyeAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  for (const [source, hash] of [
    [fixture('buleye.bas'), reference.pinnedFixtureSha256],
    [fixture('buleye-mar75-text.bas'), reference.reviewedFixtureSha256],
    [fixture('buleye-ma2.bas'), reference.portableFixtureSha256],
  ] as const) {
    assert.equal(createHash('sha256').update(source).digest('hex'), hash);
  }
  const program = api.parseProgram(buleyeSource, buleyeOptions);
  assert.equal(program.source, buleyeSource);
  let output = '';
  let randomizations = 0;
  const answers: typeof buleyeTurns = [];
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
        output += prompt + '? ';
        return Promise.resolve(turn.answer);
      },
    },
    buleyeOptions,
  );
  for (const source of [program, undefined]) {
    answers.push(...buleyeTurns);
    const result = await basic.runAsync(source, {instructionLimit: 15_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 360);
    assert.deepEqual(answers, []);
    assert.equal(output, buleyeTerminalTranscript);
    output = '';
  }
  assert.equal(randomizations, 2);
}
