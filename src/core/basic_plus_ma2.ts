/** Internal pinned V4A MA2 addition; see docs/basic-plus-ma2-addition.md. */
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';
import type {BasicPlusFloatingValue} from './basic_plus_floating_words.ts';

export type BasicPlusMa2Operation = 'add' | 'subtract';
export type BasicPlusMa2Result =
  | Readonly<{kind: 'value'; words: readonly [number, number]}>
  | Readonly<{
      kind: 'numeric-event';
      code: 48;
      reason: 'overflow' | 'underflow';
    }>
  | Readonly<{
      kind: 'unsupported';
      operand: 'left' | 'right';
      reason: 'four-word-precision' | 'signed-zero' | 'zero-exponent-fraction';
    }>;

function value(sign: number, significand: number, exponent: number): BasicPlusMa2Result {
  // Remove the restored hidden bit when packing the high fraction word.
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

function rangeEvent(reason: 'overflow' | 'underflow'): BasicPlusMa2Result {
  return Object.freeze({
    kind: 'numeric-event',
    code: 48,
    reason,
  });
}

export function basicPlusMa2Arithmetic(
  left: readonly number[],
  operation: BasicPlusMa2Operation,
  right: readonly number[],
): BasicPlusMa2Result {
  if (operation !== 'add' && operation !== 'subtract') {
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
  let large: {sign: number; significand: number; exponent: number} = {
    sign: operands[0].sign,
    significand: Number(operands[0].significand),
    exponent: operands[0].binaryExponent + 128 + 24,
  };
  let small = {
    sign: operands[1].sign * (operation === 'subtract' ? -1 : 1),
    significand: Number(operands[1].significand),
    exponent: operands[1].binaryExponent + 128 + 24,
  };
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
  if (sum >= 2 ** 25) {
    sum = Math.floor(sum / 2);
    exponent++;
  }
  while (sum < 2 ** 24) {
    sum *= 2;
    exponent--;
  }
  if (exponent < 1) return rangeEvent('underflow');

  let significand = Math.floor(sum / 2) + (sum % 2);
  if (significand === 2 ** 24) {
    significand /= 2;
    exponent++;
  }
  if (exponent > 255) return rangeEvent('overflow');
  return value(sign, significand, exponent);
}
