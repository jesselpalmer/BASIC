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
  expect(() => new Basic().run(parsed)).toThrow(TypeError);
  expect(() => basic.reset(prepareInternalSelectedProgram(prior) as never)).toThrow(
    'cannot be installed publicly',
  );
  expect(() => basic.run('10 PRINT "NEVER"\n20 END\n30 PRINT RND()')).toThrow(BasicSyntaxError);
  expect(writes).toEqual(['PRIOR\n']);
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual(['PRIOR\n', 'PRIOR\n']);
});
