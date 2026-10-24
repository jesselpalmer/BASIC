import {describe, it, expect, beforeEach} from 'bun:test';
import {jest} from 'bun:test';
import int from '../int_command.ts';

describe('INT', () => {
  let output: ReturnType<typeof jest.fn<(text: string) => void>>;

  beforeEach(() => {
    output = jest.fn();
  });

  it.each([
    ['-1.6', -2],
    ['1.6180', 1],
    ['0', 0],
    ['-2', -2],
    ['0.9', 0],
    ['.5', 0],
    ['  -1.6  ', -2],
  ])('floors %s to %s', (source, expected) => {
    int(source, {write: output});
    expect(output).toHaveBeenCalledWith(`${expected}\n`);
  });

  it.each(['not-a-number', '1.2oops', '', ' ', 'Infinity', undefined, '0x10', '0b10', '1e2'])(
    'rejects invalid input %s',
    (source) => {
      expect(() => int(source, {write: output})).toThrow('Invalid number');
      expect(output).not.toHaveBeenCalled();
    },
  );
});
