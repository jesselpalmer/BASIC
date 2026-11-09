import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/litqz-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const litqzOptions = {dialect: 'edusystem-30'} as const;
export const litqzSource = readFileSync(
  new URL('./package/fixtures/classic/litqz-mar75-text.bas', import.meta.url),
  'utf8',
);
export const litqzRounds = reference.rounds;

export function assertLitqzOutput(output: string, round: (typeof litqzRounds)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), round.outputSha256, output);
}

export async function runLitqzAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicSyntaxError' | 'parseProgram' | 'validateProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(litqzSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(litqzSource, litqzOptions);
  assert.equal(program.source, litqzSource);
  let output = '';
  let answers: string[] = [];
  const write = (text: string) => (output += text);
  const basic = new api.Basic(
    {
      write,
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    litqzOptions,
  );
  basic.reset(program);
  for (const round of litqzRounds) {
    output = '';
    answers = [...round.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 100});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, round.lastLabel);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assertLitqzOutput(output, round);
  }

  output = '';
  const stop = api.parseProgram(
    String.raw`10 PRINT "BEFORE";\STOP\PRINT "WRONG"
20 PRINT "ALSO WRONG"
30 END`,
    litqzOptions,
  );
  basic.reset(stop);
  const beforeStop = basic.step();
  assert.equal(beforeStop.nextLocation?.start.column, 20);
  const stopped = basic.step();
  assert.equal(stopped.status, 'halted');
  assert.equal(stopped.currentLocation?.start.column, 20);
  assert.equal(stopped.nextLocation, null);
  assert.equal(output + '\n', reference.stopProbe.beforeReady.STOP);
  assert.deepEqual(basic.step(), stopped);

  assert.throws(() => api.parseProgram('10 STOP', litqzOptions), /requires END/);
  assert.throws(() => api.parseProgram('10 STOP'), api.BasicSyntaxError);
  assert.throws(
    () => api.validateProgram(stop.lines.map((line) => ({...line, dialect: 'native'}))),
    /STOP requires the EDUSYSTEM-30 profile/,
  );
  output = '';
  new api.Basic({write}).run('10 STOP=2\n20 PRINT STOP');
  assert.equal(output, '2\n');
}
