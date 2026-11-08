import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Basic from './runtime.ts';
import {parseProgram} from '../parser/parser.ts';
import {decodeSourceDocument, encodeSourceDocument} from './source_document.ts';
import {BasicSyntaxError} from './diagnostic.ts';
import {prepareInternalSelectedProgram} from './prepared_program.ts';

const dialect = 'basic-plus-v4a12-ma2' as const;
const game = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

test('public selected Basic retains exact board state across seven jumps, retry and replay', async () => {
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
  const writes: string[] = [];
  const checkpoints: Array<{
    moves: number;
    square12: number;
    cells: readonly (number | string)[];
    output: string;
  }> = [];
  const basic = new Basic(
    {
      write: (text) => writes.push(text),
      readLine: (prompt) => {
        if (prompt === 'JUMP FROM') {
          checkpoints.push({
            moves: basic.variables.find(({name}) => name === 'M')!.value as number,
            square12: basic.arrays.find(({name}) => name === 'A')!.values[12] as number,
            cells: basic.arrays.find(({name}) => name === 'A')!.values.slice(1),
            output: writes.join(''),
          });
        }
        return Promise.resolve(answers.shift() ?? null);
      },
    },
    {dialect},
  );
  expect((await basic.runAsync(parseProgram(game, {dialect}))).status).toBe('halted');
  expect(checkpoints).toHaveLength(11);
  expect(checkpoints[7]).toMatchObject({moves: 7, square12: 0});
  expect(checkpoints[8].cells).toEqual(checkpoints[7].cells);
  expect(checkpoints[8].output.slice(checkpoints[7].output.length)).toBe(
    '\nILLEGAL MOVE.  TRY AGAIN...\n',
  );
  expect(checkpoints[9]).toMatchObject({moves: 0, square12: 1});
  expect(checkpoints[9].cells).toEqual(checkpoints[0].cells);
  expect(checkpoints[10].moves).toBe(1);
  expect(writes.join('')).toContain('YOU MADE 7 JUMPS AND HAD 41 PIECES');
  expect(writes.join('')).toContain('YOU MADE 1 JUMPS AND HAD 47 PIECES');
  expect(answers).toEqual([]);
});

test('public selected Basic can replay a long 1CHECK game through END', async () => {
  // A legal 28-jump path from the 48-piece opening, expressed as from-to pairs.
  const moves = [
    '1-19 2-20 3-21 4-22 9-27 14-28 15-29',
    '16-30 17-35 19-37 20-38 25-43 30-44 31-45',
    '32-46 42-28 50-36 36-18 51-37 37-19 52-38',
    '47-29 53-39 48-30 61-47 40-54 62-48 63-45',
  ].flatMap((row) => row.split(' ').flatMap((move) => move.split('-')));
  const answers = [...moves, '0', 'YES', ...moves, '0', 'NO'];
  const writes: string[] = [];
  const basic = new Basic(
    {
      write: (text) => writes.push(text),
      readLine: () => Promise.resolve(answers.shift() ?? null),
    },
    {dialect},
  );

  expect((await basic.runAsync(game, {scheduler: () => Promise.resolve()})).status).toBe('halted');
  expect(writes.filter((text) => text === 'YOU MADE 28 JUMPS AND HAD 20 PIECES\n')).toHaveLength(2);
  expect(writes.at(-1)).toBe('O. K.  HOPE YOU HAD FUN!\n');
  expect(answers).toEqual([]);
});

test('public selected Program retains exact source and runs a complete 1CHECK session', async () => {
  const parsed = parseProgram(game, {dialect});
  expect(parsed.source).toBe(game);
  expect(parsed.lines.every((line) => line.dialect === dialect)).toBe(true);
  expect(Object.isFrozen(parsed.lines)).toBe(true);
  const writes: string[] = [];
  const answers = ['0', 'NO'];
  const basic = new Basic(
    {write: (text) => writes.push(text), readLine: () => Promise.resolve(answers.shift() ?? null)},
    {dialect},
  );
  expect(basic.dialect).toBe(dialect);
  expect((await basic.runAsync(parsed)).status).toBe('halted');
  expect(writes.join('')).toContain('YOU MADE 0 JUMPS AND HAD 48 PIECES');
  expect(answers).toEqual([]);
  expect(decodeSourceDocument(encodeSourceDocument(game, {dialect}))).toEqual({
    format: 'basic-program',
    version: 1,
    dialect,
    source: game,
  });
});

test('selected source and supplied trees are checked before effects, including dead source', () => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, {dialect});
  const prior = '10 PRINT "PRIOR"\r\n20 END';
  const parsed = parseProgram(prior, {dialect});
  expect(parsed.source).toBe(prior);
  expect(basic.run(parsed).status).toBe('halted');

  for (const forged of [
    {...parsed, source: '10 PRINT "OTHER"\r\n20 END'},
    {...parsed, lines: [{...parsed.lines[0], source: '10 PRINT "OTHER"'}, parsed.lines[1]]},
    {
      ...parsed,
      lines: [
        {
          ...parsed.lines[0],
          location: {...parsed.lines[0].location, start: {line: 99, column: 1, offset: 0}},
        },
        parsed.lines[1],
      ],
    },
  ]) {
    expect(() => basic.reset(forged)).toThrow('Supplied candidate tree disagrees with its source');
  }
  expect(() => basic.reset({type: 'Program', lines: parsed.lines, source: prior})).toThrow(
    TypeError,
  );
  expect(() => basic.reset({type: 'Program', dialect, lines: parsed.lines})).toThrow(
    'requires exact source',
  );
  expect(() => basic.reset({...parsed, lines: undefined} as never)).toThrow(
    'Expected an array of parsed lines',
  );
  expect(() => basic.reset({...parsed, type: 'Line'} as never)).toThrow(
    'Expected a selected Program',
  );
  expect(() => new Basic().run(parsed)).toThrow(TypeError);
  expect(() => basic.reset(prepareInternalSelectedProgram(prior) as never)).toThrow(
    'cannot be installed publicly',
  );
  expect(() => basic.run('10 PRINT "NEVER"\n20 END\n30 PRINT RND()')).toThrow(BasicSyntaxError);
  expect(writes).toEqual(['PRIOR\n']);
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual(['PRIOR\n', 'PRIOR\n']);
});

test('selected execution uses the same supplied source snapshot it validates', () => {
  const source = '10 PRINT "VALIDATED"';
  const parsed = parseProgram(source, {dialect});
  let sourceReads = 0;
  const supplied = {
    ...parsed,
    get source() {
      sourceReads++;
      return sourceReads <= 2 ? source : '10 PRINT "UNCHECKED"';
    },
  };
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, {dialect});

  expect(basic.run(supplied).status).toBe('halted');
  expect(writes).toEqual(['VALIDATED\n']);
  expect(sourceReads).toBe(1);
});
