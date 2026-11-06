/** Mathematical conversion fact only; BASIC index/error policy remains gated. */
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';

export type Ma2WordConversion =
  | Readonly<{kind: 'value'; value: number}>
  | Readonly<{
      kind: 'unsupported';
      reason:
        'four-word-precision' | 'signed-zero' | 'zero-exponent-fraction' | 'signed-word-range';
    }>;

export function truncateMa2ToWord(words: readonly number[]): Ma2WordConversion {
  const decoded = decodeBasicPlusFloatingWords(words);
  if (decoded.kind === 'unsupported') return decoded;
  const value = decoded.value;
  if (value.precision !== 24)
    return Object.freeze({kind: 'unsupported', reason: 'four-word-precision'});
  const magnitude =
    value.binaryExponent >= 0
      ? value.significand << BigInt(value.binaryExponent)
      : value.significand >> BigInt(-value.binaryExponent);
  const integer = magnitude * BigInt(value.sign);
  if (integer < -32768n || integer > 32767n)
    return Object.freeze({kind: 'unsupported', reason: 'signed-word-range'});
  return Object.freeze({kind: 'value', value: Number(integer)});
}
