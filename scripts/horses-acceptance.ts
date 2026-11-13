import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/horses-edusystem30-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';

export const horsesOptions = {dialect: 'edusystem-30-mark'} as const;
export const horsesSource = readFileSync(
  new URL('../examples/omsi/HORSES.bas', import.meta.url),
  'utf8',
);
export const horsesMenuSource = readFileSync(
  new URL('../examples/omsi/DEMON.bas', import.meta.url),
  'utf8',
);
export const horsesSessions = reference.sessions;
export const horsesPrograms = new Map([
  ['HORSES', horsesSource],
  ['DEMON ', horsesMenuSource],
]);
export const horsesMenuPrompt = "(OR TYPE 'LIST' FOR A LISTING) ?";

export function assertHorsesOutput(output: string, session: (typeof horsesSessions)[number]): void {
  assert.equal(output, session.output);
}

export async function runHorsesAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(horsesSource).digest('hex'),
    reference.adaptedFixtureSha256,
  );
  for (const session of horsesSessions) {
    const fromMenu = session.entry === 'DEMON';
    const source = fromMenu ? horsesMenuSource : horsesSource;
    const program = api.parseProgram(source, horsesOptions);
    assert.equal(program.source, source);
    let output = '';
    const inputs = [...session.inputs];
    const loaded: string[] = [];
    const basic = new api.Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          output += prompt;
          const input = inputs.shift();
          if (input) {
            assert.equal(prompt, input.numeric ? '?' : '');
            assert.ok(output.endsWith(input.prompt));
          }
          return Promise.resolve(input?.answer ?? null);
        },
        loadProgram(name) {
          loaded.push(name);
          return horsesPrograms.get(name) ?? null;
        },
      },
      horsesOptions,
    );
    await assert.rejects(basic.runAsync(program, {instructionLimit: 50000}), (error) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 170);
      return true;
    });
    assert.deepEqual(inputs, []);
    assert.deepEqual(loaded, fromMenu ? ['HORSES', 'DEMON '] : ['DEMON ']);
    assert.equal(basic.activeSource, horsesMenuSource);
    assertHorsesOutput(output, session);
  }
}
