import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const reviewedSource = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

// Independent board oracle: 1→19 removes 1 and 10; 3→21 removes 3 and 12.
// Both destinations are in the initially empty central four-column region.
const afterTwoRows = [
  '01011111',
  '10101111',
  '11101011',
  '11000011',
  '11000011',
  '11000011',
  '11111111',
  '11111111',
];
const afterTwoBoard = `\n${afterTwoRows
  .map((row) => `${[...row].map((piece) => ` ${piece} `).join('')}\n`)
  .join('')}\n`;

test('reviewed 1CHECK completes two jumps with independently enumerated board and result', async () => {
  const session = createSelectedMa2Session(reviewedSource);
  const signal = new AbortController().signal;
  const answers = ['1', '19', '3', '21', '0', 'NO'];
  const prompts: string[] = [];
  const host = {
    readLine: (prompt?: string) => {
      prompts.push(prompt ?? '');
      return Promise.resolve(answers.shift() ?? null);
    },
  };
  const opening = session.advance();
  expect(opening.pendingInput?.label).toBe(100);
  // Snapshot caps at 64 array cells: A(0)..A(63); the printed board includes A(64).
  expect(
    opening.arrays[0].values
      .slice(1)
      .reduce<number>((count, piece) => count + (piece === 1 ? 1 : 0), 0),
  ).toBe(47);
  expect(opening.arrays[0].truncated).toBe(true);
  expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
  const firstMove = await session.resumeInput(host, signal);
  expect(firstMove.pendingInput?.label).toBe(100);
  expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
  const secondMove = await session.resumeInput(host, signal);
  expect(secondMove.pendingInput?.label).toBe(100);
  expect(secondMove.output.slice(firstMove.output.length)).toBe(afterTwoBoard);
  expect(secondMove.arrays[0].values.slice(1).join('')).toBe(afterTwoRows.join('').slice(0, 63));
  expect(
    secondMove.arrays[0].values
      .slice(1)
      .reduce<number>((count, piece) => count + (piece === 1 ? 1 : 0), 0),
  ).toBe(45);
  const summary = await session.resumeInput(host, signal);
  expect(summary.pendingInput?.label).toBe(562);
  expect(summary.variables).toContainEqual({name: 'M', value: 2});
  expect(summary.variables).toContainEqual({name: 'S', value: 46});
  expect(summary.output.slice(secondMove.output.length)).toBe(
    '\nYOU MADE 2 JUMPS AND HAD 46 PIECES\nREMAINING ON THE BOARD. \n\n',
  );
  const exit = await session.resumeInput(host, signal);
  expect(exit).toMatchObject({status: 'halted', pendingInput: null});
  expect(exit.output.slice(summary.output.length)).toBe('\nO. K.  HOPE YOU HAD FUN!\n');
  expect(prompts).toEqual(['JUMP FROM', 'TO', 'JUMP FROM', 'TO', 'JUMP FROM', 'TRY AGAIN']);
  expect(answers).toEqual([]);
});
