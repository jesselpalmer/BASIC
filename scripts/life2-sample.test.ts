import {expect, test} from 'bun:test';
import {createHash} from 'node:crypto';
import sample from './package/fixtures/classic/life2-sample.json';

type Cell = '.' | '*' | '#';

function nextGeneration(board: Cell[][]): Cell[][] {
  return board.map((cells, row) =>
    cells.map((cell, column) => {
      let stars = 0;
      let hashes = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const neighbor = board[row + dr]?.[column + dc];
          if (neighbor === '*') stars++;
          if (neighbor === '#') hashes++;
        }
      }
      const count = stars + hashes;
      if (cell !== '.') return count === 2 || count === 3 ? cell : '.';
      return count === 3 ? (stars > hashes ? '*' : '#') : '.';
    }),
  );
}

// The terminal takes column, row. The first BASIC subscript is the board row.
function coordinates(text: string): [row: number, column: number] {
  const [column, row] = text.split(',').map(Number);
  expect([row, column].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)).toBe(
    true,
  );
  return [row - 1, column - 1];
}

test('pins the reviewed LIFE2 source bytes and its physical line count', async () => {
  const fixture = Bun.file(
    new URL('./package/fixtures/classic/life2-mar75-reviewed.bas', import.meta.url),
  );
  const bytes = await fixture.bytes();
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(sample.sourceSha256);
  expect(bytes).toHaveLength(1941);
  expect(new TextDecoder().decode(bytes).split('\n')).toHaveLength(79);
});

test('a reconstructed LIFE2 replay matches every board in the printed sample', () => {
  let board = Array.from({length: 5}, () => Array<Cell>(5).fill('.'));
  const checkBoard = (index: number) =>
    expect(board.map((row) => row.join(''))).toEqual(sample.boards[index]);
  for (const [player, inputs] of sample.opening.entries()) {
    for (const input of inputs) {
      const [row, column] = coordinates(input);
      expect(board[row][column]).toBe('.');
      board[row][column] = player === 0 ? '*' : '#';
    }
  }
  checkBoard(0);
  board = nextGeneration(board);
  checkBoard(1);

  for (const [turn, [first, second]] of sample.turns.entries()) {
    const [firstRow, firstColumn] = coordinates(first);
    const [secondRow, secondColumn] = coordinates(second);
    expect(board[firstRow][firstColumn]).toBe('.');
    expect(board[secondRow][secondColumn]).toBe('.');
    if (first === second) {
      expect(turn).toBe(sample.turns.length - 1);
      // The printed branch clears the offset cell, which is empty in this replay.
      expect(board[firstRow + 1][firstColumn + 1]).toBe('.');
    } else {
      board[firstRow][firstColumn] = '*';
      board[secondRow][secondColumn] = '#';
    }
    board = nextGeneration(board);
    checkBoard(turn + 2);
  }

  const cells = board.flat();
  expect(cells.filter((cell) => cell === '*')).toHaveLength(3);
  expect(cells).not.toContain('#');
  expect(sample.winner).toBe(1);
});
