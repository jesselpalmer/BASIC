/** Internal canonical selected-MA2 values, not an executable dialect. */
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';
import type {BasicPlusFloatingValue} from './basic_plus_floating_words.ts';

type UnsupportedReason = 'four-word-precision' | 'signed-zero' | 'zero-exponent-fraction';
type Unsupported = Readonly<{kind: 'unsupported'; reason: UnsupportedReason}>;
export type BasicPlusMa2UnaryOperation = 'integer' | 'absolute' | 'negate';
export type BasicPlusMa2UnaryResult =
  Readonly<{kind: 'value'; words: readonly [number, number]}> | Unsupported;
export type BasicPlusMa2Observation = Readonly<{kind: 'value'; value: number}> | Unsupported;
export type BasicPlusMa2Comparison =
  | Readonly<{kind: 'value'; order: -1 | 0 | 1}>
  | Readonly<{kind: 'unsupported'; operand: 'left' | 'right'; reason: UnsupportedReason}>;

type Decoded = Readonly<{kind: 'value'; value: BasicPlusFloatingValue}> | Unsupported;
function decode(words: readonly number[]): Decoded {
  const decoded = decodeBasicPlusFloatingWords(words);
  if (decoded.kind === 'unsupported') return decoded;
  if (decoded.value.precision !== 24) {
    return Object.freeze({kind: 'unsupported', reason: 'four-word-precision'});
  }
  return decoded;
}

function packed(sign: number, significand: number, exponent: number): BasicPlusMa2UnaryResult {
  const words: readonly [number, number] = Object.freeze(
    significand === 0
      ? [0, 0]
      : [
          (sign < 0 ? 32768 : 0) + exponent * 128 + Math.floor(significand / 65536) - 128,
          significand % 65536,
        ],
  );
  return Object.freeze({kind: 'value', words});
}

export function basicPlusMa2Unary(
  words: readonly number[],
  operation: BasicPlusMa2UnaryOperation,
): BasicPlusMa2UnaryResult {
  if (operation !== 'integer' && operation !== 'absolute' && operation !== 'negate') {
    throw new RangeError('Unsupported MA2 unary operation');
  }
  const decoded = decode(words);
  if (decoded.kind === 'unsupported') return decoded;
  const value = decoded.value;
  let sign = value.sign;
  let significand = Number(value.significand);
  let exponent = value.binaryExponent + 152;
  if (operation === 'absolute') sign = 1;
  else if (operation === 'negate') sign = sign === 1 ? -1 : 1;
  else if (significand !== 0 && value.binaryExponent < 0) {
    const bits = -value.binaryExponent;
    if (bits >= 24) return packed(sign, sign < 0 ? 2 ** 23 : 0, 129);
    const unit = 2 ** bits;
    const remainder = significand % unit;
    significand -= remainder;
    if (sign < 0 && remainder !== 0) significand += unit;
    if (significand === 2 ** 24) {
      significand /= 2;
      exponent++;
    }
  }
  return packed(sign, significand, exponent);
}

export function observeBasicPlusMa2(words: readonly number[]): BasicPlusMa2Observation {
  const decoded = decode(words);
  if (decoded.kind === 'unsupported') return decoded;
  const value = decoded.value;
  // Every canonical MA2 value is exact and normal in binary64; observation
  // does not choose native arithmetic for historical expression evaluation.
  const observation =
    value.significand === 0n
      ? 0
      : value.sign * Number(value.significand) * 2 ** value.binaryExponent;
  return Object.freeze({kind: 'value', value: observation});
}

export function compareBasicPlusMa2(
  left: readonly number[],
  right: readonly number[],
): BasicPlusMa2Comparison {
  const l = decode(left);
  if (l.kind === 'unsupported')
    return Object.freeze({kind: 'unsupported', operand: 'left', reason: l.reason});
  const r = decode(right);
  if (r.kind === 'unsupported')
    return Object.freeze({kind: 'unsupported', operand: 'right', reason: r.reason});
  const a = l.value,
    b = r.value;
  let order: -1 | 0 | 1;
  if (a.significand === 0n && b.significand === 0n) order = 0;
  else if (a.sign !== b.sign) order = a.sign < b.sign ? -1 : 1;
  else {
    let magnitude: -1 | 0 | 1;
    if (a.significand === 0n) magnitude = -1;
    else if (b.significand === 0n) magnitude = 1;
    else if (a.binaryExponent !== b.binaryExponent)
      magnitude = a.binaryExponent < b.binaryExponent ? -1 : 1;
    else magnitude = a.significand === b.significand ? 0 : a.significand < b.significand ? -1 : 1;
    order = a.sign < 0 && magnitude !== 0 ? (magnitude === 1 ? -1 : 1) : magnitude;
  }
  return Object.freeze({kind: 'value', order});
}
