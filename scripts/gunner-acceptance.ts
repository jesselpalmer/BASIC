import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/gunner-rsts-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const gunnerOptions = {dialect: 'basic-plus-v4a12-ma2'} as const;
const fixture = (name: string) =>
  readFileSync(new URL(`./package/fixtures/classic/${name}`, import.meta.url));
export const gunnerSource = fixture('gunner-ma2.bas').toString('utf8');
export const gunnerAnswers = reference.answers;
export const gunnerTerminalTranscript = reference.output;

export async function runGunnerAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  for (const [name, hash] of [
    ['gunner.bas', reference.pinnedFixtureSha256],
    ['gunner-mar75-text.bas', reference.reviewedFixtureSha256],
    ['gunner-ma2.bas', reference.portableFixtureSha256],
  ]) {
    assert.equal(createHash('sha256').update(fixture(name)).digest('hex'), hash);
  }
  const program = api.parseProgram(gunnerSource, gunnerOptions);
  assert.equal(program.source, gunnerSource);
  let output = '';
  let answers: string[] = [];
  let seeds = 0;
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      random() {
        seeds++;
        return 0;
      },
      readLine(prompt) {
        assert.equal(prompt, '');
        output += '? ';
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    gunnerOptions,
  );
  for (const source of [program, undefined]) {
    output = '';
    answers = [...gunnerAnswers];
    await assert.rejects(basic.runAsync(source, {instructionLimit: 5000}), (error) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 410);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.equal(output, gunnerTerminalTranscript);
  }
  assert.equal(seeds, 2);
  output = '';
  const probe = new api.Basic({write: (text) => (output += text)}, gunnerOptions);
  probe.run(
    '10 PRINT -46500;-43000;-32769;-32768\n20 PRINT 32767;32768;42999;43000;46500\n30 PRINT "A";"\x07";TAB(3);"B"\n40 END',
  );
  assert.equal(output, reference.printProbeOutput);
}
