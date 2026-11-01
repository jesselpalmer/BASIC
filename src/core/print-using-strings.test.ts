import {expect, test} from 'bun:test';
import {formatPrintUsing} from './print_using.ts';
import {Basic, parseLine} from '../index.ts';
import type {BasicValue, Location} from './types.ts';
const location: Location = {
  label: 10,
  start: {line: 1, column: 16, offset: 15},
  end: {line: 1, column: 19, offset: 18},
};
const format = (image: string, values: readonly BasicValue[]) =>
  formatPrintUsing(image, values, location);
test('matches the manual bang and width-two/width-four examples', () => {
  expect(format('!!!', ['AB', 'CD', 'EF'])).toBe('ACE');
  expect(format('\\'.repeat(2) + '\\  \\', ['ABCD', 'EFGHI'])).toBe('ABEFGH');
});
test.each([
  ['!', [''], ' '],
  ['!', ['ABC'], 'A'],
  ['\\\\', ['A'], 'A '],
  ['\\  \\', ['AB'], 'AB  '],
  ['\\ \\', ['ABCD'], 'ABC'],
  ['!|##|\\ \\|!', ['Ada', -2, 'xy', 'Zed'], 'A|-2|xy |Z'],
] as const)(
  'pads short strings, truncates long strings and mixes fields in image order',
  (image, values, expected) => {
    expect(format(image, values)).toBe(expected);
    expect(format(image, values).length).toBe(image.length);
  },
);
test('preserves every byte without interpreting controls and ignores unconsumed Unicode tails', () => {
  for (let i = 0; i < 256; i++)
    expect(format('!', [String.fromCharCode(i) + 'tail'])).toBe(String.fromCharCode(i));
  expect(format('!', ['A😀'])).toBe('A');
  expect(format('\\\\', ['AB😀'])).toBe('AB');
});
test.each(['\\', '\\x\\', '\\ \t\\', '\\ #\\', '\\ !\\', '\\  ', '\\\\\\'])(
  'rejects unmatched/malformed string image %j',
  (image) => {
    expect(() => format(image, ['abc'])).toThrow('PRINT USING');
  },
);
test.each([
  ['!', [1]],
  ['\\\\', [2]],
  ['!#', ['A', '2']],
  ['#!', [1, 3]],
  ['!', ['😀']],
  ['\\\\', ['Aλ']],
])('rejects mixed type/domain errors without coercion', (image, values) => {
  expect(() => format(image, values)).toThrow('PRINT USING');
});
test('enforces exact field/value/image bounds without image reuse or scanning unused text', () => {
  expect(format('!'.repeat(4096), Array<string>(4096).fill('A'.repeat(100000)))).toBe(
    'A'.repeat(4096),
  );
  expect(format('\\' + ' '.repeat(4094) + '\\', [''])).toBe(' '.repeat(4096));
  expect(() => format('!'.repeat(4097), ['A'])).toThrow('4096');
  expect(() => format('!', [])).toThrow('requires 1 values');
  expect(() => format('!', ['A', 'B'])).toThrow('requires 1 values');
  expect(() => format('!!', ['A'])).toThrow('requires 2 values');
  expect(() => format('&', ['A'])).toThrow('image character');
});
test('uses the existing native AST, preserves names and writes mixed output atomically', () => {
  const writes: string[] = [],
    b = new Basic({write: (t) => writes.push(t)});
  b.run(
    '10 DIM USING(0):USING=9:USING(0)=3\n20 PRINT USING "! ##", "AB",USING(0);\n30 PRINT USING',
  );
  expect(writes).toEqual(['A  3', '9\n']);
  expect(parseLine('10 PRINT USING "!", "A"')!.statement.type).toBe('PrintUsingStatement');
  expect(() => b.run('10 PRINT USING "!!", "A",2')).toThrow();
  expect(writes).toEqual(['A  3', '9\n']);
  b.run('10 PRINT USING "!", "Z"');
  expect(writes.at(-1)).toBe('Z\n');
});
test('evaluates every value before a later format error and keeps one host write', () => {
  const trace: string[] = [],
    b = new Basic({
      readKey: () => {
        trace.push('key');
        return 'A';
      },
      random: () => {
        trace.push('random');
        return 0.5;
      },
      write: (t) => trace.push(t),
    });
  expect(() => b.run('10 PRINT USING "!!", INKEY$(), RND()')).toThrow();
  expect(trace).toEqual(['key', 'random']);
  b.run('10 PRINT USING "!#",INKEY$(),INT(RND()*10)');
  expect(trace.slice(2)).toEqual(['key', 'random', 'A5\n']);
});
