import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createInternalSelectedBasic} from './runtime.ts';

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
const board = (rows: readonly string[]) =>
  rows.map((row) => [...row].map((cell) => ` ${cell} `).join('') + '\n').join('');

test('Basic async driver completes the reviewed seven-jump game, rejection, replay and second result', async () => {
  // The printed page 164 continues with 12→26, but square 12 was cleared
  // earlier; it must be rejected rather than repaired into an invented move.
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
  const writes: string[] = [];
  const fromCheckpoints: Array<{
    output: string;
    moveCount: number;
    square12: number;
    cells: readonly (number | string)[];
  }> = [];
  const summaries: Array<{moves: number; pieces: number}> = [];
  const basic = createInternalSelectedBasic(source, {
    write: (text) => writes.push(text),
    readLine: (prompt) => {
      prompts.push(prompt ?? '');
      if (prompt === 'JUMP FROM') {
        const squares = basic.arrays.find(({name}) => name === 'A')!.values;
        fromCheckpoints.push({
          output: writes.join(''),
          moveCount: basic.variables.find(({name}) => name === 'M')!.value as number,
          square12: squares[12] as number,
          cells: squares.slice(1),
        });
      }
      if (prompt === 'TRY AGAIN')
        summaries.push({
          moves: basic.variables.find(({name}) => name === 'M')!.value as number,
          pieces: basic.variables.find(({name}) => name === 'S')!.value as number,
        });
      return Promise.resolve(answers.shift() ?? null);
    },
  });

  expect((await basic.runAsync()).status).toBe('halted');
  expect(fromCheckpoints).toHaveLength(11);
  expect(fromCheckpoints[0]).toMatchObject({moveCount: 0, square12: 1});
  expect(fromCheckpoints[0].output).toContain(`HERE IS THE NUMERICAL BOARD:\n\n${numbered}\n\n`);
  expect(fromCheckpoints[0].output).toContain(
    `AND HERE IS THE OPENING POSITION OF THE CHECKERS:\n\n${board(openingRows)}\n`,
  );
  expect(fromCheckpoints[7]).toMatchObject({moveCount: 7, square12: 0});
  expect(fromCheckpoints[7].output.endsWith(`\n${board(seventhRows)}\n`)).toBe(true);
  expect(fromCheckpoints[8]).toMatchObject({moveCount: 7, square12: 0});
  expect(fromCheckpoints[8].cells).toEqual(fromCheckpoints[7].cells);
  expect(fromCheckpoints[8].output.slice(fromCheckpoints[7].output.length)).toBe(
    '\nILLEGAL MOVE.  TRY AGAIN...\n',
  );
  expect(fromCheckpoints[9]).toMatchObject({moveCount: 0, square12: 1});
  expect(fromCheckpoints[9].cells).toEqual(fromCheckpoints[0].cells);
  expect(fromCheckpoints[9].output).toContain(
    '\nYOU MADE 7 JUMPS AND HAD 41 PIECES\nREMAINING ON THE BOARD. \n\n',
  );
  expect(fromCheckpoints[9].output).toContain("PLEASE ANSWER 'YES' OR 'NO'. \n");
  expect(fromCheckpoints[10]).toMatchObject({moveCount: 1, square12: 1});
  expect(fromCheckpoints[10].cells[0]).toBe(0);
  expect(fromCheckpoints[10].cells[9]).toBe(0);
  expect(fromCheckpoints[10].cells[18]).toBe(1);
  expect(summaries).toEqual([
    {moves: 7, pieces: 41},
    {moves: 7, pieces: 41},
    {moves: 1, pieces: 47},
  ]);
  expect(writes.join('')).toContain(
    '\nYOU MADE 1 JUMPS AND HAD 47 PIECES\nREMAINING ON THE BOARD. \n\n',
  );
  expect(writes.join('').endsWith('\nO. K.  HOPE YOU HAD FUN!\n')).toBe(true);
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
