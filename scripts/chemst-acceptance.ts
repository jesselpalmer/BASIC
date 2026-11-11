import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/chemst-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const chemstOptions = {dialect: 'edusystem-30'} as const;
export const chemstSource = readFileSync(
  new URL('./package/fixtures/classic/chemst.bas', import.meta.url),
  'utf8',
);
export const chemstGame = reference.game;

export function assertChemstOutput(output: string): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), chemstGame.outputSha256, output);
}

export async function runChemstAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(chemstSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(chemstSource, chemstOptions);
  assert.equal(program.source, chemstSource);
  let output = '';
  let answers: string[] = [];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        output += prompt;
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    chemstOptions,
  );
  basic.reset(program);
  for (let run = 0; run < 2; run++) {
    output = '';
    answers = [...chemstGame.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 500});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 280);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(basic.variables.find(({name}) => name === 'T')?.value, 9);
    assertChemstOutput(output);
  }
}
