import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/zoop-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const zoopOptions = {dialect: 'edusystem-30-mark'} as const;
export const zoopSource = readFileSync(
  new URL('../examples/omsi/ZOOP.bas', import.meta.url),
  'utf8',
);
export const zoopMenuSource = readFileSync(
  new URL('../examples/omsi/DEMON.bas', import.meta.url),
  'utf8',
);
export const zoopSessions = reference.sessions;
export const zoopPrograms = new Map([
  ['ZOOP  ', zoopSource],
  ['DEMON ', zoopMenuSource],
]);

export const zoopMenuPrompt = "(OR TYPE 'LIST' FOR A LISTING) ?";

type ZoopSession = (typeof zoopSessions)[number];

export function zoopAnswers(session: ZoopSession): string[] {
  return [
    ...(session.entry === 'DEMON' ? ['ZOOP'] : []),
    ...session.steps.flatMap(({keys}) => keys.map((key) => (key === '\n' ? '' : key))),
  ];
}

export function zoopOutput(session: ZoopSession): string {
  return session.start + session.steps.map(({output}) => output).join('');
}

export function assertZoopOutput(output: string, session: ZoopSession): void {
  // The tape capture discards the monitor's echoed Return after menu selection.
  const normalized =
    session.entry === 'DEMON'
      ? output.replace(zoopMenuPrompt + '\n\n', zoopMenuPrompt + '\n')
      : output;
  assert.equal(normalized, zoopOutput(session));
}

export async function runZoopAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>,
): Promise<void> {
  assert.equal(
    createHash('sha256').update(zoopSource).digest('hex'),
    reference.adaptedFixtureSha256,
  );
  for (const session of zoopSessions) {
    const fromMenu = session.entry === 'DEMON';
    const source = fromMenu ? zoopMenuSource : zoopSource;
    const program = api.parseProgram(source, zoopOptions);
    assert.equal(program.source, source);

    let output = '';
    let answers: string[] = [];
    const loaded: string[] = [];
    const basic = new api.Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          assert.equal(prompt, '');
          return Promise.resolve(answers.shift() ?? null);
        },
        loadProgram(name) {
          loaded.push(name);
          return zoopPrograms.get(name) ?? null;
        },
      },
      zoopOptions,
    );
    basic.reset(program);
    for (let run = 0; run < 2; run++) {
      output = '';
      answers = zoopAnswers(session);
      loaded.length = 0;
      await assert.rejects(basic.runAsync(undefined, {instructionLimit: 3000}), (error) => {
        assert.ok(error instanceof api.BasicRuntimeError);
        assert.equal(error.diagnostic.code, 'INPUT_ENDED');
        assert.equal(error.diagnostic.label, 170);
        return true;
      });
      assert.deepEqual(answers, []);
      assert.deepEqual(loaded, [...(fromMenu ? ['ZOOP  '] : []), 'ZOOP  ', 'DEMON ']);
      assert.equal(basic.activeSource, zoopMenuSource);
      assertZoopOutput(output, session);
    }
  }
}
