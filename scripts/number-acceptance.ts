import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/number-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const numberOptions = {dialect: 'edusystem-30'} as const;
export const numberSource = readFileSync(
  new URL('./package/fixtures/classic/number-mar75-text.bas', import.meta.url),
  'utf8',
);
export const numberGames = reference.games;
export const numberPrompt = 'GUESS A NUMBER FROM 1 TO 5?';

export function assertNumberOutput(output: string, game: (typeof numberGames)[number]): void {
  assert.equal(createHash('sha256').update(output).digest('hex'), game.outputSha256, output);
}

export async function runNumberAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(numberSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(numberSource, numberOptions);
  assert.equal(program.source, numberSource);
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
    numberOptions,
  );
  basic.reset(program);
  for (const game of numberGames) {
    output = '';
    answers = [...game.answers];
    const result = await basic.runAsync(undefined, {instructionLimit: 500});
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 99);
    assert.equal(result.nextLocation, null);
    assert.equal(result.diagnostic, null);
    assert.deepEqual(answers, []);
    assert.equal(basic.variables.find(({name}) => name === 'P')?.value, Number(game.winningScore));
    assertNumberOutput(output, game);
  }
}
