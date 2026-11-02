/** Internal pinned V4A MA2 arithmetic; see docs/basic-plus-ma2-addition.md. */
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';
import type {BasicPlusFloatingValue} from './basic_plus_floating_words.ts';

export type BasicPlusMa2Operation = 'add' | 'subtract' | 'multiply' | 'divide';
export type BasicPlusMa2Result =
  | Readonly<{kind: 'value'; words: readonly [number, number]}>
  | Readonly<{
      kind: 'numeric-event';
      code: 48;
      reason: 'overflow' | 'underflow';
      continuationWords: readonly [number, number];
    }>
  | Readonly<{
      kind: 'numeric-event';
      code: 61;
      reason: 'division-by-zero';
      continuationWords: readonly [number, number];
    }>
  | Readonly<{
      kind: 'unsupported';
      operand: 'left' | 'right';
      reason: 'four-word-precision' | 'signed-zero' | 'zero-exponent-fraction';
    }>;

function packWords(sign: number, significand: number, exponent: number): readonly [number, number] {
  // Remove the restored hidden bit when packing the high fraction word.
  const words: readonly [number, number] = Object.freeze(
    significand === 0
      ? [0, 0]
      : [
          (sign < 0 ? 32768 : 0) + exponent * 128 + Math.floor(significand / 65536) - 128,
          significand % 65536,
        ],
  );
  return words;
}

function value(sign: number, significand: number, exponent: number): BasicPlusMa2Result {
  return Object.freeze({kind: 'value', words: packWords(sign, significand, exponent)});
}

function rangeEvent(
  reason: 'overflow' | 'underflow',
  continuationWords: readonly [number, number],
): BasicPlusMa2Result {
  return Object.freeze({
    kind: 'numeric-event',
    code: 48,
    reason,
    continuationWords,
  });
}

type Operand = {sign: number; significand: number; exponent: number};

function multiply(left: Operand, right: Operand): BasicPlusMa2Result {
  const top = Math.floor(right.significand / 256) * 65536;
  const low = (right.significand % 256) * 256;
  let accumulator = 0;
  // MA2 omits the right low byte for the first fifteen left bits. Reordering
  // operands or rounding an exact product changes independently observed words.
  for (let bit = 0; bit < 24; bit++) {
    if ((left.significand >>> bit) & 1) {
      accumulator += top + (bit >= 15 ? low : 0);
    }
    accumulator = Math.floor(accumulator / 2);
  }
  const normalized = accumulator >= 2 ** 31;
  let exponent = left.exponent + right.exponent - 128 - (normalized ? 0 : 1);
  if (exponent < 1) return rangeEvent('underflow', packWords(1, 0, 0));
  if (exponent > 255) return rangeEvent('overflow', packWords(1, 0, 0));
  const shift = normalized ? 8 : 7;
  let significand = Math.floor((accumulator + 2 ** (shift - 1)) / 2 ** shift);
  if (significand === 2 ** 24) {
    significand /= 2;
    exponent++;
  }
  if (exponent > 255) return rangeEvent('overflow', packWords(1, 0, 0));
  return value(left.sign * right.sign, significand, exponent);
}

function divide(left: Operand, right: Operand): BasicPlusMa2Result {
  if (right.significand === 0) {
    return Object.freeze({
      kind: 'numeric-event',
      code: 61,
      reason: 'division-by-zero',
      continuationWords: packWords(1, 0, 0),
    });
  }
  if (left.significand === 0) return value(1, 0, 0);
  const atLeastOne = left.significand >= right.significand;
  const exponent = left.exponent - right.exponent + 128 + (atLeastOne ? 1 : 0);
  if (exponent < 1) return rangeEvent('underflow', packWords(1, 0, 0));
  if (exponent > 255) return rangeEvent('overflow', packWords(1, 0, 0));
  // Exact integers below 2^48. Even the closest noninteger quotient is farther
  // from an integer than binary64's rounding error; floor cannot cross it.
  const numerator = left.significand * 2 ** (atLeastOne ? 23 : 24);
  const quotient = Math.floor(numerator / right.significand);
  const remainder = numerator - quotient * right.significand;
  const significand = quotient + (remainder * 2 >= right.significand ? 1 : 0);
  return value(left.sign * right.sign, significand, exponent);
}

export function basicPlusMa2Arithmetic(
  left: readonly number[],
  operation: BasicPlusMa2Operation,
  right: readonly number[],
): BasicPlusMa2Result {
  if (
    operation !== 'add' &&
    operation !== 'subtract' &&
    operation !== 'multiply' &&
    operation !== 'divide'
  ) {
    throw new RangeError('Unsupported MA2 arithmetic operation');
  }
  const operands: BasicPlusFloatingValue[] = [];
  for (let index = 0; index < 2; index++) {
    const decoded = decodeBasicPlusFloatingWords(index === 0 ? left : right);
    const operand = index === 0 ? 'left' : 'right';
    if (decoded.kind === 'unsupported') {
      return Object.freeze({kind: 'unsupported', operand, reason: decoded.reason});
    }
    if (decoded.value.precision !== 24) {
      return Object.freeze({kind: 'unsupported', operand, reason: 'four-word-precision'});
    }
    operands.push(decoded.value);
  }
  // The decoder bounds these significands to 24 bits before conversion to Number.
  let large: Operand = {
    sign: operands[0].sign,
    significand: Number(operands[0].significand),
    exponent: operands[0].binaryExponent + 128 + 24,
  };
  let small = {
    sign: operands[1].sign * (operation === 'subtract' ? -1 : 1),
    significand: Number(operands[1].significand),
    exponent: operands[1].binaryExponent + 128 + 24,
  };
  if (operation === 'divide') return divide(large, small);
  if (operation === 'multiply') {
    if (large.significand === 0 || small.significand === 0) return value(1, 0, 0);
    return multiply(large, small);
  }
  if (large.significand === 0) return value(small.sign, small.significand, small.exponent);
  if (small.significand === 0) return value(large.sign, large.significand, large.exponent);
  if (small.exponent > large.exponent) [large, small] = [small, large];

  let sign = large.sign;
  let exponent = large.exponent;
  let sum = large.significand * 2;
  const gap = exponent - small.exponent;
  if (gap <= 25) {
    // MA2 aligns a signed smaller integer, without a sticky-bit accumulator.
    const relativeSign = small.sign === sign ? 1 : -1;
    sum += Math.floor((relativeSign * small.significand * 2) / 2 ** gap);
  }
  if (sum === 0) return value(1, 0, 0);
  if (sum < 0) {
    sum = -sum;
    sign = -sign;
  }
  const carried = sum >= 2 ** 25;
  if (carried) {
    sum = Math.floor(sum / 2);
    exponent++;
  }
  while (sum < 2 ** 24) {
    sum *= 2;
    exponent--;
  }
  if (exponent < 1) return rangeEvent('underflow', packWords(1, 0, 0));

  let significand = Math.floor(sum / 2) + (sum % 2);
  if (significand === 2 ** 24) {
    significand /= 2;
    exponent++;
  }
  if (exponent > 255) {
    // TRAP0 skips its inline mask. Carry overflow reuses SWAB(256) as exponent1;
    // packed rounding overflow reaches the underflow continuation and clears.
    return rangeEvent('overflow', carried ? packWords(sign, significand, 1) : packWords(1, 0, 0));
  }
  return value(sign, significand, exponent);
}
