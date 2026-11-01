/** Selected V4A signed-word/string representation; no numeric argument conversion. */
import {BASIC_PLUS_STRING_LIMIT} from './basic_plus_strings.ts';

export function encodeIntegerConversionString(word: number): string {
  if (typeof word !== 'number') throw new TypeError('Integer conversion requires a number');
  if (!Number.isInteger(word) || word < -32768 || word > 32767)
    throw new RangeError('Integer conversion requires a signed 16-bit word');
  const pattern = word < 0 ? word + 65536 : word;
  return String.fromCharCode(Math.floor(pattern / 256), pattern % 256);
}

export function decodeIntegerConversionString(source: string): number {
  if (typeof source !== 'string') throw new TypeError('Integer conversion requires a string');
  if (source.length > BASIC_PLUS_STRING_LIMIT)
    throw new RangeError('Integer conversion string limit exceeded');
  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) > 255)
      throw new RangeError('Integer conversion requires byte characters');
  }
  const high = source.length === 0 ? 0 : source.charCodeAt(0);
  const low = source.length < 2 ? 0 : source.charCodeAt(1);
  const pattern = high * 256 + low;
  return pattern < 32768 ? pattern : pattern - 65536;
}
