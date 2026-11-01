import {describe, expect, test} from 'bun:test';
import {decodeMa2ConversionString, encodeMa2ConversionString} from './basic_plus_ma2_strings.ts';
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';
import reference from '../../docs/rsts-v4a-ma2-observations.json';

const bytes = (source: string) => Array.from(source, (c) => c.charCodeAt(0));

describe('selected MA2 conversion-string representation', () => {
  test.each([
    [
      [0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0x4080, 0],
      [0, 0, 64, 128],
    ],
    [
      [0xc1a0, 0],
      [0, 0, 193, 160],
    ],
    [
      [0x7fff, 0xffff],
      [255, 255, 127, 255],
    ],
    [
      [0x0080, 0],
      [0, 0, 0, 128],
    ],
    [
      [0x00ff, 0xffff],
      [255, 255, 0, 255],
    ],
    [
      [0x1234, 0x5678],
      [86, 120, 18, 52],
    ],
  ])('matches independent word/byte pair %j', (words, expected) => {
    expect(bytes(encodeMa2ConversionString(words))).toEqual(expected);
    expect([...decodeMa2ConversionString(String.fromCharCode(...expected))]).toEqual(words);
  });

  test('matches independently captured BASIC byte observations against manual words', () => {
    for (const [id, words] of [
      ['one', [0x4080, 0]],
      ['minus_five', [0xc1a0, 0]],
      ['integer_byte_order', [0x4c7f, 0x00ff]],
    ] as const) {
      const observed = reference.observations.find((row) => row.id === id)!;
      expect(bytes(encodeMa2ConversionString(words))).toEqual(observed.cvtfBytes);
      expect(decodeMa2ConversionString(String.fromCharCode(...observed.cvtfBytes))).toEqual(words);
    }
  });

  test('places every bit in each word using independent byte-position expectations', () => {
    for (let word = 0; word < 2; word++)
      for (let bit = 0; bit < 16; bit++) {
        const input = [0, 0];
        input[word] = 2 ** bit;
        const expected = [0, 0, 0, 0];
        expected[(word === 0 ? 2 : 0) + (bit < 8 ? 1 : 0)] = 2 ** (bit % 8);
        expect(bytes(encodeMa2ConversionString(input))).toEqual(expected);
        expect([...decodeMa2ConversionString(String.fromCharCode(...expected))]).toEqual(input);
      }
  });

  test('covers every one-word pattern in both byte positions', () => {
    for (let word = 0; word <= 65535; word++) {
      const high = Math.floor(word / 256),
        low = word % 256;
      expect(bytes(encodeMa2ConversionString([word, 0]))).toEqual([0, 0, high, low]);
      expect(bytes(encodeMa2ConversionString([0, word]))).toEqual([high, low, 0, 0]);
      expect(decodeMa2ConversionString(String.fromCharCode(high, low, high, low))).toEqual([
        word,
        word,
      ]);
    }
  });

  test.each([
    ['', [0, 0]],
    ['\x12', [0, 0x1200]],
    ['\x12\x34', [0, 0x1234]],
    ['\x12\x34\x56', [0x5600, 0x1234]],
    ['\x12\x34\x56\x78extra', [0x5678, 0x1234]],
    ['\xff'.repeat(32767), [65535, 65535]],
  ] as const)('null-pads or consumes the documented prefix', (source, expected) => {
    expect(decodeMa2ConversionString(source)).toEqual(expected);
  });

  test('preserves raw exponent-zero patterns without granting numeric meaning', () => {
    for (const words of [
      [0x8000, 0],
      [0, 1],
      [0x8001, 2],
    ]) {
      expect([...decodeMa2ConversionString(encodeMa2ConversionString(words))]).toEqual(words);
      expect(decodeBasicPlusFloatingWords(words).kind).toBe('unsupported');
    }
  });

  test.each([null, undefined, 'xx', {}, new Uint16Array(2)])('rejects a non-array %j', (input) => {
    expect(() => encodeMa2ConversionString(input as number[])).toThrow(TypeError);
  });
  test.each(
    [
      [],
      [0],
      [0, 0, 0],
      [0, 0, 0, 0],
      [0, -1],
      [65536, 0],
      [1.5, 0],
      [NaN, 0],
      [Infinity, 0],
      ['0', 0],
      Array(2),
    ].map((input) => [input] as const),
  )('rejects invalid words %j', (input) => {
    expect(() => encodeMa2ConversionString(input as number[])).toThrow(RangeError);
  });
  test.each([null, undefined, 0, {}, ['a']].map((input) => [input] as const))(
    'rejects a non-string %j',
    (input) => {
      expect(() => decodeMa2ConversionString(input as string)).toThrow(TypeError);
    },
  );
  test.each(['\u0100', 'abcd\u0100', '\ud800', '😀', 'x'.repeat(32768)])(
    'rejects the entire non-byte/oversized input',
    (source) => {
      expect(() => decodeMa2ConversionString(source)).toThrow(RangeError);
    },
  );

  test('bounds reads and ignores hostile iterators without retaining caller arrays', () => {
    const reads: PropertyKey[] = [];
    const input = new Proxy([0x1234, 0x5678], {
      get(target, key, receiver) {
        reads.push(key);
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    Object.defineProperty(input, Symbol.iterator, {
      get() {
        throw new Error('Iterator must not run');
      },
    });
    const output = encodeMa2ConversionString(input);
    expect(reads).toEqual(['length', '0', '1']);
    input.fill(0);
    const words = decodeMa2ConversionString(output);
    expect(words).toEqual([0x1234, 0x5678]);
    expect(Object.isFrozen(words)).toBe(true);
    expect(() => Object.assign(words, {0: 0})).toThrow(TypeError);
    const huge = new Proxy(Array(100000), {
      get(target, key, receiver) {
        if (key !== 'length') throw new Error('Payload must not be read');
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    expect(() => encodeMa2ConversionString(huge)).toThrow(RangeError);
    const failure = new Error('Accessor failure');
    const broken = [0, 0];
    Object.defineProperty(broken, '0', {
      get() {
        throw failure;
      },
    });
    expect(() => encodeMa2ConversionString(broken)).toThrow(failure);
  });
});
