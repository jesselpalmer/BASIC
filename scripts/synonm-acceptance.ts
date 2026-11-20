import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/synonm-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const synonmOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url));
export const synonmSource = fixture('synonm-ma2.bas').toString('utf8');
export const synonmTerminalTranscript = reference.output;
export const synonmTurns = reference.turns;
const terminalPrompts = /\? /g;
const browserChunks = synonmTerminalTranscript.split(terminalPrompts);
assert.equal(browserChunks.length, synonmTurns.length + 1);
export const synonmBrowserOpening = browserChunks[0];
export const synonmBrowserTranscript = browserChunks
  .map((chunk, index) =>
    index < synonmTurns.length ? chunk + synonmTurns[index].answer + '\n' : chunk,
  )
  .join('');

export async function runSynonmAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  for (const [source, hash] of [
    [fixture('synonm.bas'), reference.pinnedFixtureSha256],
    [fixture('synonm-mar75-text.bas'), reference.reviewedFixtureSha256],
    [fixture('synonm-ma2.bas'), reference.portableFixtureSha256],
  ] as const) {
    assert.equal(createHash('sha256').update(source).digest('hex'), hash);
  }
  const program = api.parseProgram(synonmSource, synonmOptions);
  assert.equal(program.source, synonmSource);
  let output = '';
  let randomizations = 0;
  const answers: typeof synonmTurns = [];
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
    synonmOptions,
  );
  for (const source of [program, undefined]) {
    answers.push(...synonmTurns);
    const result = await basic.runAsync(source, {instructionLimit: 15_000});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 420);
    assert.deepEqual(answers, []);
    assert.equal(output, synonmTerminalTranscript);
    output = '';
  }
  assert.equal(randomizations, 2);
}
