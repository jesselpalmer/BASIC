import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type * as PublicApi from '../src/index.ts';

type Api = Pick<
  typeof PublicApi,
  'Basic' | 'BasicRuntimeError' | 'BasicSyntaxError' | 'parseProgram'
>;

/** Exact observable output, using only the direct or installed module supplied. */
export function runAdjacentPrintAcceptance(api: Api): void {
  const writes: string[] = [];
  let draws = 0;
  const basic = new api.Basic({
    write: (text) => writes.push(text),
    random: () => {
      draws++;
      return 0.25;
    },
  });
  basic.run(
    [
      '10 DIM USING(1,2),WORDS$(1)',
      '20 USING=4',
      '30 USING(1,2)=7',
      '40 USING$="word"',
      '50 B$=" b"',
      '60 WORDS$(1)="array"',
      '70 PRINT "score=" USING " / " USING(1,2) " / " (USING+1)',
      '80 PRINT "text:" USING$ B$ WORDS$(1);',
      '90 PRINT "|" 1-2',
      '100 PRINT USING B$;2',
    ].join('\n'),
  );
  assert.deepEqual(writes, ['score=4 / 7 / 5\n', 'text:word barray', '|-1\n', '4 b2\n']);
  writes.length = 0;
  assert.throws(
    () => basic.run('10 PRINT "before"\n20 PRINT "draw=" RND() ":" 1/0\n30 PRINT "must not run"'),
    (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'DIVISION_BY_ZERO');
      assert.equal(error.diagnostic.label, 20);
      return true;
    },
  );
  assert.equal(draws, 1);
  assert.deepEqual(writes, ['before\n']);
  assert.equal(basic.status, 'error');
  basic.run('10 PRINT "after="1');
  assert.deepEqual(writes, ['before\n', 'after=1\n']);
}

export function runPrintUsingAcceptance(api: Api): void {
  const writes: string[] = [];
  const basic = new api.Basic({write: (text) => writes.push(text)});
  basic.run(
    '10 DIM USING(1,2),T$(0)\n20 USING=7\n30 USING(1,2)=8\n40 T$(0)="## ##"\n50 PRINT USING\n60 PRINT USING (1,2)\n70 PRINT USING T$(0),-2,9;\n80 PRINT "end"',
  );
  assert.deepEqual(writes, ['7\n', '8\n', '-2  9', 'end\n']);
  assert.throws(
    () => basic.run('10 PRINT USING "#",12'),
    (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'FORMAT_OVERFLOW');
      assert.equal(error.diagnostic.column, 16);
      return true;
    },
  );
  assert.deepEqual(writes, ['7\n', '8\n', '-2  9', 'end\n']);
  basic.run('10 PRINT USING("##"),1');
  assert.equal(writes.at(-1), ' 1\n');
  const statement = api.parseProgram('10 PRINT USING "##",1;').lines[0].statement;
  assert.equal(statement.type, 'PrintUsingStatement');
  if (statement.type !== 'PrintUsingStatement') throw new Error('Expected public formatted AST');
  assert.equal(statement.items.length, 1);
  assert.equal(statement.separators.length, 2);
  assert.ok(Object.isFrozen(statement.items));
  const width = '\\' + ' '.repeat(2) + '\\';
  basic.run(`10 PRINT USING "!!!","AB","CD","EF"\n20 PRINT USING "${width}|!|##","xy","Zed",-2`);
  assert.deepEqual(writes.slice(-2), ['ACE\n', 'xy  |Z|-2\n']);
  const before = writes.length;
  assert.throws(() => basic.run('10 PRINT USING "!!","first",2'), api.BasicRuntimeError);
  assert.equal(writes.length, before);
  basic.run('10 PRINT USING "!",""');
  assert.equal(writes.at(-1), ' \n');
  basic.run('10 PRINT USING "**###|###|!",27,-12,"Zed"');
  assert.equal(writes.at(-1), '***27|-12|Z\n');
  const beforeAsterisks = writes.length;
  assert.throws(() => basic.run('10 PRINT USING "**# **#",1,-1'), api.BasicRuntimeError);
  assert.equal(writes.length, beforeAsterisks);
  basic.run('10 PRINT USING "**#",123');
  assert.equal(writes.at(-1), '123\n');
}

/** Corrected source is a separate fixture; native output is not a historical pass. */
export async function runNativeCheckerAcceptance(api: Api): Promise<void> {
  const raw = readFileSync(new URL('./package/fixtures/classic/1check-raw.bas', import.meta.url));
  const corrected = readFileSync(
    new URL('./package/fixtures/classic/1check-corrected.bas', import.meta.url),
  );
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    '87b6ea841f5e6ff0af0718ef3f4f905c992535455afd5d3400b1e2946c30d04f',
  );
  assert.equal(
    createHash('sha256').update(corrected).digest('hex'),
    '952576cf60f86f5548a880e261e06f6e7353ad607827596d83e028ddbe7ece94',
  );
  assert.equal(
    corrected.toString(),
    raw.toString().replace('74 PRINT USING B$;J,', '74 PRINT USING B$,J,'),
  );
  assert.equal(raw.length, corrected.length);
  assert.equal([...raw].filter((byte, index) => byte !== corrected[index]).length, 1);
  const writes: string[] = [],
    prompts: string[] = [];
  const answers: string[] = [];
  const jumpStates: (readonly PublicApi.BasicValue[])[] = [];
  const basic = new api.Basic({
    write: (text) => writes.push(text),
    readLine: (prompt) => {
      prompts.push(prompt ?? '');
      if (prompt === 'JUMP FROM? ') jumpStates.push(basic.arrays[0].values);
      return Promise.resolve(answers.shift() ?? null);
    },
  });
  const rejectRaw = () =>
    assert.rejects(basic.runAsync(raw.toString(), {instructionLimit: 10000}), (error: unknown) => {
      assert.ok(error instanceof api.BasicSyntaxError);
      assert.equal(error.diagnostic.label, 74);
      assert.ok(error.diagnostic.message.includes('Expected , after the PRINT USING template'));
      return true;
    });
  await rejectRaw();
  assert.deepEqual(writes, []);
  const initial = [
    '11111111',
    '11111111',
    '11000011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
  ];
  const moved = [
    '01111111',
    '10111111',
    '11100011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
  ];
  const numbered = [
    ' 1  2   3   4   5   6   7   8',
    ' 9 10  11  12  13  14  15  16',
    '17 18  19  20  21  22  23  24',
    '25 26  27  28  29  30  31  32',
    '33 34  35  36  37  38  39  40',
    '41 42  43  44  45  46  47  48',
    '49 50  51  52  53  54  55  56',
    '57 58  59  60  61  62  63  64',
  ];
  for (let run = 0; run < 2; run++) {
    writes.length = 0;
    prompts.length = 0;
    jumpStates.length = 0;
    answers.push('1', '2', '1', '19', '0', 'MAYBE', 'YES', '0', 'NO');
    const result = await basic.runAsync(run === 0 ? corrected.toString() : undefined, {
      instructionLimit: 10000,
    });
    assert.equal(result.status, 'halted');
    assert.equal(result.currentLocation?.label, 999);
    assert.deepEqual(answers, []);
    assert.deepEqual(prompts, [
      'JUMP FROM? ',
      'TO? ',
      'JUMP FROM? ',
      'TO? ',
      'JUMP FROM? ',
      'TRY AGAIN? ',
      'TRY AGAIN? ',
      'JUMP FROM? ',
      'TRY AGAIN? ',
    ]);
    const transcript: string = writes.join('');
    const lines: string[] = transcript.split('\n');
    assert.deepEqual(
      lines.filter((line) => /^[01]{8}$/.test(line)),
      [...initial, ...moved, ...initial],
    );
    assert.deepEqual(
      lines.filter((line) => numbered.includes(line)),
      [...numbered, ...numbered],
    );
    assert.equal(jumpStates.length, 4);
    assert.deepEqual(jumpStates[0], jumpStates[1], 'An illegal move must not alter the board');
    assert.deepEqual(jumpStates[0], jumpStates[3], 'YES must reconstruct the opening board');
    assert.equal(jumpStates[2][1], 0);
    assert.equal(jumpStates[2][10], 0);
    assert.equal(jumpStates[2][19], 1);
    assert.equal(lines.filter((line) => line === 'ILLEGAL MOVE.  TRY AGAIN...').length, 1);
    assert.equal(lines.filter((line) => line === "PLEASE ANSWER 'YES' OR 'NO'.").length, 1);
    assert.ok(transcript.includes('YOU MADE1JUMPS AND HAD47PIECES\n'));
    assert.ok(transcript.includes('YOU MADE0JUMPS AND HAD48PIECES\n'));
    assert.ok(transcript.endsWith('O.K.  HOPE YOU HAD FUN!\n'));
    const writeCount: number = writes.length;
    await rejectRaw();
    assert.equal(writes.length, writeCount, 'Rejected raw replacement must have no effects');
  }

  // Printed page164 has a continuous seven-move prefix, then a sample gap.
  // Literal board oracles are reviewed independently in classic-source-review.md.
  const openingBoards = [
    initial,
    moved,
    '00111111/10011111/11110011/11000011/11000011/11000011/11111111/11111111'.split('/'),
    '00011111/10001111/11111011/11000011/11000011/11000011/11111111/11111111'.split('/'),
    '00011110/10001101/11111111/11000011/11000011/11000011/11111111/11111111'.split('/'),
    '00011110/10001100/11111101/11000111/11000011/11000011/11111111/11111111'.split('/'),
    '00011110/10001100/11111100/11000101/11000111/11000011/11111111/11111111'.split('/'),
    '00011110/10001100/11111100/11000101/11000111/11000111/11111101/11111110'.split('/'),
  ];
  writes.length = 0;
  prompts.length = 0;
  jumpStates.length = 0;
  answers.push(
    '1',
    '19',
    '2',
    '20',
    '3',
    '21',
    '8',
    '22',
    '16',
    '30',
    '24',
    '38',
    '64',
    '46',
    '12',
    '26',
    '0',
    'NO',
  );
  const openingResult = await basic.runAsync(undefined, {instructionLimit: 10000});
  assert.equal(openingResult.status, 'halted');
  assert.equal(openingResult.currentLocation?.label, 999);
  assert.deepEqual(answers, []);
  assert.deepEqual(prompts, [
    ...Array.from({length: 8}, () => ['JUMP FROM? ', 'TO? ']).flat(),
    'JUMP FROM? ',
    'TRY AGAIN? ',
  ]);
  // Public snapshots deliberately include only cells0..63; output below checks
  // all64 board squares, and the final S checks the complete post-rejection sum.
  assert.deepEqual(
    jumpStates,
    [...openingBoards, openingBoards[7]].map((rows) =>
      [0, ...rows.join('').split('').map(Number)].slice(0, 64),
    ),
  );
  assert.equal(jumpStates[7][12], 0, 'The next printed move starts from an empty square');
  assert.deepEqual(jumpStates[7], jumpStates[8], '12-to26 must preserve the observed board prefix');
  assert.ok(basic.variables.some(({name, value}) => name === 'M' && value === 7));
  assert.ok(basic.variables.some(({name, value}) => name === 'S' && value === 41));
  const openingTranscript = writes.join('');
  assert.deepEqual(
    openingTranscript.split('\n').filter((line) => /^[01]{8}$/.test(line)),
    openingBoards.flat(),
  );
  assert.equal(openingTranscript.split('ILLEGAL MOVE.  TRY AGAIN...').length - 1, 1);
  assert.ok(openingTranscript.includes('YOU MADE7JUMPS AND HAD41PIECES\n'));
  assert.ok(openingTranscript.endsWith('O.K.  HOPE YOU HAD FUN!\n'));
}
