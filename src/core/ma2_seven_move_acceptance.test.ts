import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const source = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

// Printed page 164 has a continuous seven-move prefix. Its next visible move
// cannot follow this board: 3→21 previously removed square 12 as a midpoint.
const rows = [
  '00011110',
  '10001100',
  '11111100',
  '11000101',
  '11000111',
  '11000111',
  '11111101',
  '11111110',
];
const renderedBoard = `${rows.map((row) => `${[...row].map((piece) => ` ${piece} `).join('')}\n`).join('')}\n`;

test('selected reviewed 1CHECK rejects the discontinuous printed move after seven jumps', async () => {
  const session = createSelectedMa2Session(source);
  const signal = new AbortController().signal;
  const moves = [
    [1, 19],
    [2, 20],
    [3, 21],
    [8, 22],
    [16, 30],
    [24, 38],
    [64, 46],
  ];
  const answers = [
    ...moves.flatMap(([from, to]) => [String(from), String(to)]),
    '12',
    '26',
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
  let seventh = session.advance();
  expect(seventh.pendingInput?.label).toBe(100);
  for (let move = 0; move < moves.length; move++) {
    expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
    seventh = await session.resumeInput(host, signal);
    expect(seventh.pendingInput?.label).toBe(100);
  }
  expect(seventh.variables).toContainEqual({name: 'M', value: 7});
  expect(seventh.output.endsWith(renderedBoard)).toBe(true);
  expect(seventh.arrays[0].values[12]).toBe(0);
  const before = seventh.arrays;
  expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
  const rejected = await session.resumeInput(host, signal);
  expect(rejected.pendingInput?.label).toBe(100);
  expect(rejected.output.slice(seventh.output.length)).toBe('\nILLEGAL MOVE.  TRY AGAIN...\n');
  expect(rejected.arrays).toEqual(before);
  expect(rejected.variables).toContainEqual({name: 'M', value: 7});
  const summary = await session.resumeInput(host, signal);
  expect(summary.pendingInput?.label).toBe(562);
  expect(summary.variables).toContainEqual({name: 'S', value: 41});
  expect(summary.output).toContain('YOU MADE 7 JUMPS AND HAD 41 PIECES\n');
  expect((await session.resumeInput(host, signal)).status).toBe('halted');
  expect(prompts).toEqual([
    ...moves.flatMap(() => ['JUMP FROM', 'TO']),
    'JUMP FROM',
    'TO',
    'JUMP FROM',
    'TRY AGAIN',
  ]);
  expect(answers).toEqual([]);
});
