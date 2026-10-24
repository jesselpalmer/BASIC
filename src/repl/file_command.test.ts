import {expect, it} from 'bun:test';
import {parseFileCommand} from './file_command.ts';

it('parses case-insensitive file commands while preserving literal filenames', () => {
  expect(parseFileCommand(' \tsAvE\t')).toEqual({kind: 'SAVE'});
  expect(parseFileCommand('load "MiXeD Path\\game.bas"')).toEqual({
    kind: 'LOAD',
    path: 'MiXeD Path\\game.bas',
  });
  expect(parseFileCommand('\tSaVe\t"say ""hello"".bas" \t')).toEqual({
    kind: 'SAVE',
    path: 'say "hello".bas',
  });
  for (const text of ['RUN', 'LOADMORE "a.bas"', '', '10 LOAD "a.bas"']) {
    expect(parseFileCommand(text)).toBeNull();
  }
});

it.each([
  'LOAD',
  'LOAD path.bas',
  'LOAD"path.bas"',
  'LOAD ""',
  'LOAD "unfinished',
  'SAVE "a" "b"',
  'SAVE "a" trailing',
  'SAVE "a\nb"',
  'SAVE "a\rb"',
  'SAVE "a\0b"',
])('rejects malformed file command %j without prefix parsing', (text) => {
  expect(() => parseFileCommand(text)).toThrow('quoted filename');
});
