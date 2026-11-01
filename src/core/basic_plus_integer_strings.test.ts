import {expect, test} from 'bun:test';
import {
  decodeIntegerConversionString,
  encodeIntegerConversionString,
} from './basic_plus_integer_strings.ts';

test.each([
  [-32768, [128, 0]],
  [-32767, [128, 1]],
  [-257, [254, 255]],
  [-256, [255, 0]],
  [-1, [255, 255]],
  [0, [0, 0]],
  [1, [0, 1]],
  [255, [0, 255]],
  [256, [1, 0]],
  [0x1234, [18, 52]],
  [32767, [127, 255]],
] as const)('matches signed word %i and independent byte pair', (word, pair) => {
  expect(encodeIntegerConversionString(word)).toBe(String.fromCharCode(...pair));
  expect(decodeIntegerConversionString(String.fromCharCode(...pair))).toBe(word);
});
test('places every bit and distinguishes byte reversal and the signed high bit', () => {
  for (let bit = 0; bit < 16; bit++) {
    const pair = bit < 8 ? [0, 2 ** bit] : [2 ** (bit - 8), 0];
    const signed = bit === 15 ? -32768 : 2 ** bit;
    expect(encodeIntegerConversionString(signed)).toBe(String.fromCharCode(...pair));
    expect(decodeIntegerConversionString(String.fromCharCode(...pair))).toBe(signed);
  }
  expect(decodeIntegerConversionString('\x12\x34')).toBe(4660);
  expect(decodeIntegerConversionString('\x34\x12')).toBe(13330);
});
test('covers all 65536 words against independent byte arithmetic', () => {
  for (let high = 0; high < 256; high++)
    for (let low = 0; low < 256; low++) {
      const signed = (high < 128 ? high : high - 256) * 256 + low;
      const text = String.fromCharCode(high, low);
      expect(encodeIntegerConversionString(signed)).toBe(text);
      expect(decodeIntegerConversionString(text)).toBe(signed);
    }
});
test.each([
  ['', 0],
  ['\x12', 4608],
  ['\x80', -32768],
  ['\xff', -256],
  ['\x12\x34ignored', 4660],
  ['\xff'.repeat(32767), -1],
] as const)('null-pads short inputs or consumes their prefix', (source, expected) => {
  expect(decodeIntegerConversionString(source)).toBe(expected);
});
test('normalizes native negative zero to the unique integer zero representation', () => {
  expect(encodeIntegerConversionString(-0)).toBe('\0\0');
  expect(Object.is(decodeIntegerConversionString('\0\0'), -0)).toBe(false);
});
test.each([NaN, Infinity, -Infinity, 32768, -32769, 1.5, -1.5])(
  'rejects invalid signed word %j',
  (value) => {
    expect(() => encodeIntegerConversionString(value)).toThrow(RangeError);
  },
);
test.each([null, undefined, {}, '1', true].map((value) => [value] as const))(
  'rejects a nonnumeric host argument',
  (value) => {
    expect(() => encodeIntegerConversionString(value as number)).toThrow(TypeError);
  },
);
test.each([null, undefined, {}, 2, ['a'], new String('ab')].map((value) => [value] as const))(
  'rejects a non-string host argument',
  (value) => {
    expect(() => decodeIntegerConversionString(value as string)).toThrow(TypeError);
  },
);
test.each(['\u0100', 'ab\u0100', '😀', '\ud800', 'x'.repeat(32768)])(
  'rejects non-byte input and checks unused suffixes and size before producing results',
  (value) => {
    expect(() => decodeIntegerConversionString(value)).toThrow(RangeError);
  },
);
