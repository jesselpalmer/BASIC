import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/tictac-edusystem30-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const tictacOptions = {dialect: 'edusystem-30-mark'} as const;
export const tictacSource = readFileSync(
  new URL('../examples/omsi/TICTAC.bas', import.meta.url),
  'utf8',
);
export const tictacMenuSource = readFileSync(
  new URL('../examples/omsi/DEMON.bas', import.meta.url),
  'utf8',
);
export const tictacSessions = reference.sessions;
export const tictacPrograms = new Map([
  ['TICTAC', tictacSource],
  ['DEMON ', tictacMenuSource],
]);
export const tictacMenuPrompt = "(OR TYPE 'LIST' FOR A LISTING) ?";

export function assertTictacOutput(output: string, session: (typeof tictacSessions)[number]): void {
  const normalized =
    session.entry === 'DEMON'
      ? output.replace(tictacMenuPrompt + '\n\n', tictacMenuPrompt + '\n')
      : output;
  assert.equal(normalized, session.output);
}

export async function runTictacAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(tictacSource).digest('hex'),
    reference.adaptedFixtureSha256,
  );
  for (const session of tictacSessions) {
    const fromMenu = session.entry === 'DEMON';
    const source = fromMenu ? tictacMenuSource : tictacSource;
    const program = api.parseProgram(source, tictacOptions);
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
          return tictacPrograms.get(name) ?? null;
        },
      },
      tictacOptions,
    );
    await assert.rejects(basic.runAsync(program, {instructionLimit: 8000}), (error) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 170);
      return true;
    });
    assert.deepEqual(answers, []);
    assert.deepEqual(loaded, fromMenu ? ['TICTAC', 'DEMON '] : ['DEMON ']);
    assert.equal(basic.activeSource, tictacMenuSource);
    assertTictacOutput(output, session);
  }
}
