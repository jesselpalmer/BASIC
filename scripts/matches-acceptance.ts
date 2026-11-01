import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type * as PublicApi from '../src/index.ts';

type Api = Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError' | 'parseProgram'>;

export const matchesRaw = readFileSync(
  new URL('./package/fixtures/classic/23mtch.bas', import.meta.url),
  'utf8',
);
export const matchesCorrected = readFileSync(
  new URL('./package/fixtures/classic/23mtch-corrected.bas', import.meta.url),
  'utf8',
);

// Independent expected counts/choices for seven human moves of one. EOF at the
// next round bounds the original infinite replay without modifying its code.
export const matchesRemaining = [23, 21, 17, 13, 9, 5, 1, 23] as const;
export const matchesChoices = [1, 3, 3, 3, 3, 3] as const;
export const matchesIntroduction =
  [
    "LET'S PLAY 23 MATCHES.  WE START WITH 23 MATCHES.",
    'YOU MOVE FIRST. YOU MAY TAKE 1, 2 OR 3 MATCHES.',
    'THEN I MOVE... I MAY TAKE 1, 2 OR 3 MATCHES.',
    'YOU MOVE, I MOVE AND SO ON. THE ONE WHO HAS TO',
    'TAKE THE LAST MATCH LOSES.',
    'GOOD LUCK AND MAY THE BEST COMPUTER (HA HA) WIN.',
  ].join('\n') + '\n\n';

/** Native spelling, not the historical system's number padding or prompt rules. */
export function expectedMatchesOutput(corrected: boolean, invalidMoves = 0, echo = false): string {
  const question = '\nHOW MANY DO YOU TAKE\n';
  let result = matchesIntroduction + '\nTHERE ARE NOW23MATCHES.\n' + question;
  const invalid = ['0', '4', '1.5', '24'];
  for (let i = 0; i < invalidMoves; i++)
    result +=
      (echo ? invalid[i] + '\n' : '') +
      "YOU CHEATED! BUT I'LL GIVE YOU ANOTHER CHANCE.\n" +
      question;
  for (let i = 0; i < matchesChoices.length; i++)
    result +=
      (echo ? '1\n' : '') +
      '\nI TOOK' +
      matchesChoices[i] +
      '...' +
      (corrected ? '' : '\n') +
      'THERE ARE NOW' +
      matchesRemaining[i + 1] +
      'MATCHES.\n' +
      question;
  return (
    result +
    (echo ? '1\n' : '') +
    '\nI WON!! BETTER LUCK NEXT TIME.\n\n\nTHERE ARE NOW23MATCHES.\n' +
    question
  );
}

export async function runMatchesCorrectionAcceptance(api: Api): Promise<void> {
  assert.equal(
    createHash('sha256').update(matchesRaw).digest('hex'),
    '6406621c19cfac9961d0b4fa36ba50d322f4697648b1021fe99cace6ef9d8896',
  );
  assert.equal(
    createHash('sha256').update(matchesCorrected).digest('hex'),
    '6e20090bfdebc2f4760baa7568d53d6a64e18310f2f9daf6e95a883666956364',
  );
  assert.equal(
    matchesCorrected,
    matchesRaw.replace('380 PRINT "I TOOK";C;"..."\n', '380 PRINT "I TOOK";C;"...";\n'),
  );
  assert.equal(Buffer.byteLength(matchesCorrected), Buffer.byteLength(matchesRaw) + 1);
  const rawProgram = api.parseProgram(matchesRaw);
  const program = api.parseProgram(matchesCorrected);
  assert.equal(program.lines.length, rawProgram.lines.length);
  const line = program.lines.find((line) => line.label === 380)!;
  assert.equal(line.statement.type, 'PrintStatement');
  if (line.statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
  assert.equal(line.statement.trailingSemicolon, true);
  assert.ok(Object.isFrozen(line.statement));

  for (const [source, corrected] of [
    [matchesRaw, false],
    [matchesCorrected, true],
  ] as const) {
    const output: string[] = [];
    const prompts: (string | undefined)[] = [];
    const counts: unknown[] = [];
    const answers = ['0', '4', '1.5', '24', ...Array<string>(7).fill('1')];
    let randomCalls = 0;
    const basic = new api.Basic({
      write: (text) => output.push(text),
      readLine: (prompt) => {
        prompts.push(prompt);
        counts.push(basic.variables.find(({name}) => name === 'M')?.value);
        return Promise.resolve(answers.shift() ?? null);
      },
      random: () => {
        randomCalls++;
        return 0.5;
      },
    });
    await assert.rejects(basic.runAsync(source, {instructionLimit: 1000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INPUT_ENDED');
      assert.equal(error.diagnostic.label, 230);
      return true;
    });
    assert.equal(output.join(''), expectedMatchesOutput(corrected, 4));
    assert.deepEqual(counts, [23, 23, 23, 23, ...matchesRemaining]);
    assert.deepEqual(prompts, Array<string>(12).fill('? '));
    assert.equal(randomCalls, 0);

    output.length = 0;
    answers.push(...Array<string>(7).fill('1'));
    await assert.rejects(
      basic.runAsync(undefined, {instructionLimit: 1000}),
      api.BasicRuntimeError,
    );
    assert.equal(output.join(''), expectedMatchesOutput(corrected));
    // Reaching the randomized branch remains an explicit blocker in both sources.
    output.length = 0;
    answers.push('2');
    await assert.rejects(basic.runAsync(undefined, {instructionLimit: 500}), (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'INVALID_ARGUMENT_COUNT');
      assert.equal(error.diagnostic.label, 330);
      return true;
    });
    assert.equal(randomCalls, 0, 'Native arity checking precedes the RNG callback');
    assert.equal(
      output.join(''),
      matchesIntroduction + '\nTHERE ARE NOW23MATCHES.\n\nHOW MANY DO YOU TAKE\n',
    );
    basic.run('10 PRINT "after matches"');
    assert.equal(output.at(-1), 'after matches\n');
  }
}
