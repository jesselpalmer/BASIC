import {signedNumericLiteral} from './numeric_literal.ts';

/** Stored EDU30 value: significand * 2^(exponent - 23). */
export type EduSystem30FloatingValue = Readonly<{significand: bigint; exponent: number}>;

const wordBits = 12n;
const wordMask = (1n << wordBits) - 1n;
const significandBits = 23;
const minimumExponent = -2048;
const maximumExponent = 2047;
const zero: EduSystem30FloatingValue = Object.freeze({significand: 0n, exponent: 0});
const ieeeWords = new DataView(new ArrayBuffer(8));
const ieeeFraction = 1n << 52n;

/** Normalize an exact dyadic value given as bits * 2^binaryExponent. */
function normalize(bits: bigint, binaryExponent: number): EduSystem30FloatingValue {
  if (bits === 0n) return zero;
  const negative = bits < 0n;
  const magnitude = negative ? -bits : bits;
  const width = magnitude.toString(2).length;
  const exponent = binaryExponent + width;
  if (exponent < minimumExponent || exponent > maximumExponent)
    throw new RangeError('EDUSYSTEM-30 binary exponent is outside its supported range');
  // A negative BigInt shift count shifts the magnitude left.
  const shifted = magnitude >> BigInt(width - significandBits);
  return {significand: negative ? -shifted : shifted, exponent};
}

/** Capture the exact binary value supplied by a shared runtime boundary. */
export function eduSystem30FromNumber(value: number): EduSystem30FloatingValue {
  if (!Number.isFinite(value)) throw new RangeError('Numbers must be finite');
  ieeeWords.setFloat64(0, value);
  const words = ieeeWords.getBigUint64(0);
  const exponent = Number((words >> 52n) & 2047n);
  const fraction = words & (ieeeFraction - 1n);
  const sign = words >> 63n ? -1n : 1n;
  return normalize(
    sign * (exponent === 0 ? fraction : fraction | ieeeFraction),
    Math.max(exponent, 1) - 1075,
  );
}

/** Observe a stored number for the public variable or shared loop boundary. */
export function observeEduSystem30(value: EduSystem30FloatingValue): number {
  const significand = Number(value.significand);
  return value.exponent > 0
    ? significand * 2 ** (value.exponent - significandBits)
    : (significand / 2 ** significandBits) * 2 ** value.exponent;
}

export function eduSystem30Absolute(value: EduSystem30FloatingValue): EduSystem30FloatingValue {
  return value.significand < 0n ? {...value, significand: -value.significand} : value;
}

export function eduSystem30Integer(value: EduSystem30FloatingValue): EduSystem30FloatingValue {
  const places = significandBits - value.exponent;
  return places <= 0 ? value : normalize(value.significand >> BigInt(places), 0);
}

function align(
  left: EduSystem30FloatingValue,
  right: EduSystem30FloatingValue,
): readonly [bigint, bigint, number] {
  const exponent = Math.min(left.exponent, right.exponent);
  return [
    left.significand << BigInt(left.exponent - exponent),
    right.significand << BigInt(right.exponent - exponent),
    exponent,
  ];
}

export function compareEduSystem30(
  left: EduSystem30FloatingValue,
  right: EduSystem30FloatingValue,
): number {
  const [a, b] = align(left, right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function divide(
  left: EduSystem30FloatingValue,
  right: EduSystem30FloatingValue,
): EduSystem30FloatingValue {
  if (right.significand === 0n) throw new RangeError('Cannot divide by zero');
  const negative = left.significand < 0n !== right.significand < 0n;
  const numerator = (left.significand < 0n ? -left.significand : left.significand) << 22n;
  const divisor = right.significand < 0n ? -right.significand : right.significand;
  const quotient = numerator / divisor;
  const remainderHigh = (numerator % divisor) >> wordBits;
  const negativeDivisorHigh = (-divisor >> wordBits) & wordMask;
  // The PDP-8 rotates the high remainder word twice through Link before
  // adding the high word of the negated divisor. Link corrects the quotient.
  const correction = ((4n * remainderHigh + negativeDivisorHigh) >> wordBits) & 1n;
  return normalize(
    (negative ? -quotient : quotient) + correction,
    left.exponent - right.exponent - 22,
  );
}

export function evaluateEduSystem30Arithmetic(
  operator: '+' | '-' | '*' | '/',
  left: EduSystem30FloatingValue,
  right: EduSystem30FloatingValue,
): EduSystem30FloatingValue {
  if (operator === '/') return divide(left, right);
  if (operator === '*')
    return normalize(
      left.significand * right.significand,
      left.exponent + right.exponent - 2 * significandBits,
    );
  const [a, b, exponent] = align(left, right);
  return normalize(operator === '+' ? a + b : a - b, exponent - significandBits);
}

const ten = normalize(10n, 0);
const eightDecimalPlaces = normalize(100_000_000n, 0);

function accumulateDigits(digits: string): EduSystem30FloatingValue {
  let value = zero;
  for (const digit of digits) {
    const product = evaluateEduSystem30Arithmetic('*', value, ten);
    value = evaluateEduSystem30Arithmetic('+', product, normalize(BigInt(digit), 0));
  }
  return value;
}

/** Apply decimal scaling in the stored EDU30 order, eight places at a time. */
export function scaleEduSystem30Decimal(
  value: EduSystem30FloatingValue,
  places: number,
): EduSystem30FloatingValue {
  if (value.significand === 0n) return zero;
  const operation = places < 0 ? '/' : '*';
  const magnitude = Math.abs(places);
  for (let index = 0; index < Math.floor(magnitude / 8); index++)
    value = evaluateEduSystem30Arithmetic(operation, value, eightDecimalPlaces);
  for (let index = 0; index < magnitude % 8; index++)
    value = evaluateEduSystem30Arithmetic(operation, value, ten);
  return value;
}

/** Convert a complete numeric INPUT field using the verified EDU30 scale order. */
export function parseEduSystem30Input(text: string): EduSystem30FloatingValue {
  if (signedNumericLiteral.exec(text)?.[0] !== text)
    throw new SyntaxError('Expected a complete decimal field');
  const [mantissa, exponentText = '0'] = text.replace(/^[+-]/, '').split(/[Ee]/);
  const exponent = Number(exponentText);
  if (!Number.isInteger(exponent) || exponent < minimumExponent || exponent > maximumExponent)
    throw new RangeError('EDUSYSTEM-30 decimal exponent is outside its supported range');
  const [whole, fractional = ''] = mantissa.split('.');
  const fraction = scaleEduSystem30Decimal(accumulateDigits(fractional), -fractional.length);
  const combined = evaluateEduSystem30Arithmetic('+', accumulateDigits(whole), fraction);
  const scaled = scaleEduSystem30Decimal(combined, exponent);
  return text.startsWith('-') && scaled.significand !== 0n
    ? {significand: -scaled.significand, exponent: scaled.exponent}
    : scaled;
}
