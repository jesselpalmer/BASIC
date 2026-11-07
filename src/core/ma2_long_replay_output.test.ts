import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const source = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const numbered = [
  ' 1  2   3   4   5   6   7   8',
  ' 9 10  11  12  13  14  15  16',
  '17 18  19  20  21  22  23  24',
  '25 26  27  28  29  30  31  32',
  '33 34  35  36  37  38  39  40',
  '41 42  43  44  45  46  47  48',
  '49 50  51  52  53  54  55  56',
  '57 58  59  60  61  62  63  64',
].join('\n');
const openingRows = [
  '11111111',
  '11111111',
  '11000011',
  '11000011',
  '11000011',
  '11000011',
  '11111111',
  '11111111',
];
const seventhRows = [
  '00011110',
  '10001100',
  '11111100',
  '11000101',
  '11000111',
  '11000111',
  '11111101',
  '11111110',
];
function board(rows: readonly string[]) {
  return rows.map((row) => [...row].map((cell) => ` ${cell} `).join('') + '\n').join('');
}

test('seven-move output, rejected printed move, replay and a new game retain exact source layout', async () => {
  const session = createSelectedMa2Session(source);
  const signal = new AbortController().signal;
  const answers = [
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
    'MAYBE',
    'YES',
    '1',
    '19',
    '0',
    'NO',
  ];
  const prompts: string[] = [];
  const host = {
    readLine: (prompt?: string) => {
      prompts.push(prompt ?? '');
      return Promise.resolve(answers.shift() ?? null);
    },
  };
  const opening = session.advance();
  expect(opening.output).toContain(`HERE IS THE NUMERICAL BOARD:\n\n${numbered}\n\n`);
  expect(
    opening.output.endsWith(
      `AND HERE IS THE OPENING POSITION OF THE CHECKERS:\n\n${board(openingRows)}\n`,
    ),
  ).toBe(true);
  let result = opening;
  for (let move = 0; move < 7; move++) {
    expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
    result = await session.resumeInput(host, signal);
    expect(result.pendingInput?.label).toBe(100);
  }
  expect(result.output.endsWith(`\n${board(seventhRows)}\n`)).toBe(true);
  expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
  const rejected = await session.resumeInput(host, signal);
  expect(rejected.output.slice(result.output.length)).toBe('\nILLEGAL MOVE.  TRY AGAIN...\n');
  const summary = await session.resumeInput(host, signal);
  expect(summary.pendingInput?.label).toBe(562);
  expect(summary.output.slice(rejected.output.length)).toBe(
    '\nYOU MADE 7 JUMPS AND HAD 41 PIECES\nREMAINING ON THE BOARD. \n\n',
  );
  const retry = await session.resumeInput(host, signal);
  expect(retry.output.slice(summary.output.length)).toBe("PLEASE ANSWER 'YES' OR 'NO'. \n");
  const replay = await session.resumeInput(host, signal);
  expect(replay.pendingInput?.label).toBe(100);
  expect(replay.variables).toContainEqual({name: 'M', value: 0});
  expect(replay.output.slice(retry.output.length)).toBe(
    `${numbered}\n\nAND HERE IS THE OPENING POSITION OF THE CHECKERS:\n\n${board(openingRows)}\n`,
  );
  expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
  const firstJump = await session.resumeInput(host, signal);
  expect(firstJump.pendingInput?.label).toBe(100);
  const secondSummary = await session.resumeInput(host, signal);
  expect(secondSummary.output.slice(firstJump.output.length)).toBe(
    '\nYOU MADE 1 JUMPS AND HAD 47 PIECES\nREMAINING ON THE BOARD. \n\n',
  );
  const exit = await session.resumeInput(host, signal);
  expect(exit.output.slice(secondSummary.output.length)).toBe('\nO. K.  HOPE YOU HAD FUN!\n');
  expect(exit.status).toBe('halted');
  expect(prompts).toEqual([
    ...Array.from({length: 8}, () => ['JUMP FROM', 'TO']).flat(),
    'JUMP FROM',
    'TRY AGAIN',
    'TRY AGAIN',
    'JUMP FROM',
    'TO',
    'JUMP FROM',
    'TRY AGAIN',
  ]);
  expect(answers).toEqual([]);
});
