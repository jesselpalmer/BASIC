import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/bagles-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const baglesOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url));
export const baglesSource = fixture('bagles-ma2.bas').toString('utf8');
export const baglesTerminalTranscript = reference.output;
export const baglesTurns = reference.turns;
const terminalPrompts =
  /(?:GAME OF BAGLES\. {2}WOULD YOU LIKE THE RULES \(YES OR NO\)|PLAY AGAIN \(YES OR NO\))?\? /g;
const browserChunks = baglesTerminalTranscript.split(terminalPrompts);
assert.equal(browserChunks.length, baglesTurns.length + 1);
export const baglesBrowserOpening = browserChunks[0];
export const baglesBrowserTranscript = browserChunks
  .map((chunk, index) =>
    index < baglesTurns.length ? chunk + baglesTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runBaglesAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  for (const [source, hash] of [
    [fixture('bagels.bas'), reference.pinnedFixtureSha256],
    [fixture('bagles-mar75-text.bas'), reference.reviewedFixtureSha256],
    [baglesSource, reference.portableFixtureSha256],
  ] as const) {
    assert.equal(createHash('sha256').update(source).digest('hex'), hash);
  }
  const program = api.parseProgram(baglesSource, baglesOptions);
  assert.equal(program.source, baglesSource);
  let output = '';
  let randomizations = 0;
  const answers: typeof baglesTurns = [];
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
    baglesOptions,
  );
  for (const source of [program, undefined]) {
    answers.push(...baglesTurns);
    const result = await basic.runAsync(source, {instructionLimit: 15_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.deepEqual(answers, []);
    assert.equal(output, baglesTerminalTranscript);
    output = '';
  }
  assert.equal(randomizations, 2);
}
