import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/wekday-edusystem30-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const wekdayOptions = {dialect: 'edusystem-30-mark'} as const;
export const wekdaySource = readFileSync(
  new URL('../examples/omsi/WEKDAY.bas', import.meta.url),
  'utf8',
);
export const wekdayMenuSource = readFileSync(
  new URL('../examples/omsi/DEMON.bas', import.meta.url),
  'utf8',
);
export const wekdaySessions = reference.sessions;
export const wekdayPrograms = new Map([
  ['WEKDAY', wekdaySource],
  ['DEMON ', wekdayMenuSource],
]);
export const wekdayMenuPrompt = "(OR TYPE 'LIST' FOR A LISTING) ?";

export function assertWekdayOutput(output: string, session: (typeof wekdaySessions)[number]): void {
  const normalized =
    session.entry === 'DEMON'
      ? output.replace(wekdayMenuPrompt + '\n\n', wekdayMenuPrompt + '\n')
      : output;
  assert.equal(normalized, session.output);
}

export async function runWekdayAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(wekdaySource).digest('hex'),
    reference.adaptedFixtureSha256,
  );
  for (const session of wekdaySessions) {
    const fromMenu = session.entry === 'DEMON';
    const source = fromMenu ? wekdayMenuSource : wekdaySource;
    const program = api.parseProgram(source, wekdayOptions);
    assert.equal(program.source, source);
    let output = '';
    const answers = [...session.answers];
    const loaded: string[] = [];
    const basic = new api.Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          output += prompt;
          return Promise.resolve(answers.shift() ?? null);
        },
        loadProgram(name) {
          loaded.push(name);
          return wekdayPrograms.get(name) ?? null;
        },
      },
      wekdayOptions,
    );
    await assert.rejects(basic.runAsync(program, {instructionLimit: 2000}), (error) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 170);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.deepEqual(loaded, fromMenu ? ['WEKDAY', 'DEMON '] : ['DEMON ']);
    assert.equal(basic.activeSource, wekdayMenuSource);
    assertWekdayOutput(output, session);
  }
}
