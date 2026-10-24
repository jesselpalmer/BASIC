import {describe, it, expect, jest} from 'bun:test';
import abs from '../abs_command.ts';
import int from '../int_command.ts';

describe('numeric command arguments', () => {
  it.each([
    ['-3.14', 3.14],
    ['+3.14', 3.14],
    ['0', 0],
    ['-0', 0],
    ['.5', 0.5],
    ['1.', 1],
    [' \t-1.6\t ', 1.6],
  ])('ABS accepts complete decimal %s', (source, expected) => {
    const write = jest.fn<(text: string) => void>();
    abs(source, {write});
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(`${expected}\n`);
  });

  it.each([
    '12oops',
    '1.2.3',
    '0x10',
    '0b10',
    '1e2',
    '1e+2',
    '',
    ' \t',
    'Infinity',
    '-Infinity',
    'NaN',
    '9'.repeat(400),
    undefined,
  ])('ABS and INT reject the same invalid argument %s', (source) => {
    for (const command of [abs, int]) {
      const write = jest.fn<(text: string) => void>();
      expect(() => command(source, {write})).toThrow('Invalid number');
      expect(write).not.toHaveBeenCalled();
    }
  });
});
