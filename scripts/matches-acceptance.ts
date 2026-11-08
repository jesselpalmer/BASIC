import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type * as PublicApi from '../src/index.ts';

type Api = Pick<
  typeof PublicApi,
  'Basic' | 'BasicRuntimeError' | 'BasicSyntaxError' | 'parseProgram'
>;

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

export const eduSystem30Dialect = 'edusystem-30' as const;
export const matchesReviewed = readFileSync(
  new URL('./package/fixtures/classic/23mtch-mar75-text.bas', import.meta.url),
  'utf8',
);
// Printed loss, replay and win, then a probe that consumes the sixth draw.
export const reviewedAnswers = [
  '3',
  '1',
  '2',
  '1',
  '1',
  '0',
  '1',
  '2',
  '3',
  '3',
  '2',
  '1',
  '1',
  '2',
];

// Reattach the OS/8 banner omitted by the app to compare with the pinned
// EDU30.SV transcript digest in docs/edusystem30-reference.json.
export function assertReviewedTranscript(gameTranscript: string): void {
  assert.equal(
    createHash('sha256')
      .update('\f\n\n*NONE*  EDUSYSTEM-30\n\n' + gameTranscript)
      .digest('hex'),
    '6048e49b741755ef8348da20e8d04502e70072f3732acdd3f5aebb4ce8861b5c',
    gameTranscript,
  );
}

export async function runEduSystem30Acceptance(api: Api): Promise<void> {
  assert.equal(
    createHash('sha256').update(matchesReviewed).digest('hex'),
    '6b4ce01cdd00a638a415801bd912f9cbfe8ae02d1e42c6b41e759246f1f94ecc',
  );
  const options = {dialect: eduSystem30Dialect};
  const program = api.parseProgram(matchesReviewed, options);
  assert.equal(program.source, matchesReviewed);
  assert.ok(program.lines.every((line) => line.dialect === eduSystem30Dialect));
  let output = '';
  let answers = [...reviewedAnswers];
  const basic = new api.Basic(
    {
      write: (text) => (output += text),
      readLine(prompt) {
        assert.equal(prompt, '?');
        const answer = answers.shift();
        output += prompt + (answer === undefined ? '' : answer + '\n');
        return Promise.resolve(answer ?? null);
      },
      random: () => assert.fail('EDUSYSTEM-30 uses its own RUN seed'),
    },
    options,
  );

  const endsAtInput = (error: unknown) => {
    assert.ok(error instanceof api.BasicRuntimeError);
    assert.equal(error.diagnostic.code, 'INPUT_ENDED');
    assert.equal(error.diagnostic.label, 230);
    return true;
  };
  await assert.rejects(basic.runAsync(program, {instructionLimit: 1000}), endsAtInput);
  assertReviewedTranscript(output);
  assert.throws(
    () => basic.reset({...program, source: matchesReviewed.replace('LET M=23', 'LET M=22')}),
    /disagrees with its source/,
  );
  assert.throws(() => basic.reset({...program, source: undefined}), /requires exact source/);
  assert.throws(() => basic.reset(api.parseProgram('10 END')), TypeError);
  assert.throws(() => new api.Basic().reset(program), TypeError);
  for (const statement of [
    'LET A=RND()',
    'LET A=RND(1)',
    'LET AB=1',
    'LET A="X"',
    'LET A=1.5',
    'LET A=2^3',
    'WAIT 1',
    'PRINT A B$',
    'INPUT "N";A',
  ]) {
    assert.throws(
      () => basic.run(`10 PRINT "NEVER"\n20 END\n30 ${statement}\n40 END`),
      (error: unknown) => {
        assert.ok(error instanceof api.BasicSyntaxError);
        assert.equal(error.diagnostic.code, 'UNSUPPORTED_EDUSYSTEM30_FORM');
        assert.equal(error.diagnostic.label, 30);
        return true;
      },
    );
  }
  assert.throws(() => api.parseProgram('10 PRINT "NO END"', options), /requires END/);
  assert.throws(() => api.parseProgram('10 GO TO 30\n20 END', options), /No line label 30/);
  assert.throws(() => basic.readLine('10 END'), /complete source program/);
  assertReviewedTranscript(output);

  output = '';
  answers = ['ABC', '1.5', '2'];
  await assert.rejects(basic.runAsync(undefined, {instructionLimit: 500}), endsAtInput);
  assert.match(output, /TAKE\?ABC\nBAD DATA-RETYPE FROM ERROR\.\n\?1\.5\nYOU CHEATED!/);
  assert.match(output, /I TOOK 1 \.\.\.THERE ARE NOW 20 MATCHES\./);
}
