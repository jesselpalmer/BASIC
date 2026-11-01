/** Internal selected-build representation mapping; not numeric evaluation. */
import {BASIC_PLUS_STRING_LIMIT} from './basic_plus_strings.ts';

export function encodeMa2ConversionString(words: readonly number[]): string {
  if (!Array.isArray(words)) throw new TypeError('MA2 conversion words must be an array');
  const length = words.length;
  if (length !== 2) throw new RangeError('MA2 conversion requires exactly two words');
  const snapshot: number[] = [];
  for (let index = 0; index < length; index++) {
    const word: unknown = words[index];
    if (typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > 65535)
      throw new RangeError('MA2 conversion word must be an integer in 0..65535');
    snapshot.push(word);
  }
  // The conversion string reverses word order, with high byte first per word.
  return String.fromCharCode(
    Math.floor(snapshot[1] / 256),
    snapshot[1] % 256,
    Math.floor(snapshot[0] / 256),
    snapshot[0] % 256,
  );
}

export function decodeMa2ConversionString(source: string): readonly [number, number] {
  if (typeof source !== 'string') throw new TypeError('MA2 conversion input must be a string');
  if (source.length > BASIC_PLUS_STRING_LIMIT)
    throw new RangeError('MA2 conversion string limit exceeded');
  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) > 255)
      throw new RangeError('MA2 conversion requires byte characters');
  }
  // Table11-2 consumes the first four characters and null-pads a short string.
  const byte = (index: number) => (index < source.length ? source.charCodeAt(index) : 0);
  return Object.freeze([byte(2) * 256 + byte(3), byte(0) * 256 + byte(1)]);
}
