import {numericLiteral, signedNumericLiteral} from './numeric_literal.ts';

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

// The compiler's scale factors use a signed exponent and two unsigned octal words.
const positiveSourceScales = [
  [0o0004, 0o5000, 0o0000],
  [0o0007, 0o6200, 0o0000],
  [0o0016, 0o4704, 0o0000],
  [0o0033, 0o5753, 0o6040],
  [0o0066, 0o4341, 0o5710],
  [0o0153, 0o4734, 0o2654],
  [0o0325, 0o6047, 0o4036],
  [0o0652, 0o4473, 0o5104],
  [0o1523, 0o5247, 0o7342],
  [0o3245, 0o7061, 0o4606],
];
const negativeSourceScales = [
  [0o7775, 0o6314, 0o6315],
  [0o7772, 0o5075, 0o3413],
  [0o7763, 0o6433, 0o3430],
  [0o7746, 0o5274, 0o6170],
  [0o7713, 0o7151, 0o2624],
  [0o7626, 0o6373, 0o0436],
  [0o7454, 0o5207, 0o7752],
  [0o7127, 0o6735, 0o0106],
  [0o6256, 0o6003, 0o0502],
  [0o4534, 0o4404, 0o4754],
];

/** Convert a source token in the archived compiler's order. */
export function parseEduSystem30SourceLiteral(text: string): EduSystem30FloatingValue {
  if (numericLiteral.exec(text)?.[0] !== text)
    throw new SyntaxError('Expected a complete unsigned decimal literal');
  const [mantissa, exponent = '0'] = text.split(/[Ee]/);
  const [whole, fractional = ''] = mantissa.split('.');
  const digits = (whole + fractional).replace(/^0+/, '');
  const scale = Number(exponent) - fractional.length;
  const factors = scale < 0 ? negativeSourceScales : positiveSourceScales;
  if (digits.length > 11 || !(Math.abs(scale) < 2 ** factors.length))
    throw new RangeError('EDUSYSTEM-30 source literal is outside its compiled decimal range');
  const bits = BigInt(digits);
  if (bits >= 1n << 35n)
    throw new RangeError('EDUSYSTEM-30 source literal exceeds its 35-bit digit accumulator');

  let value = normalize(bits, 0);
  for (let bit = 0, magnitude = Math.abs(scale); magnitude; bit++, magnitude >>>= 1) {
    if (!(magnitude & 1)) continue;
    const [word, high, low] = factors[bit];
    const exponent = word >= 0o4000 ? word - 0o10000 : word;
    const factor = (BigInt(high) << wordBits) | BigInt(low);
    // The compiler discards the low product word before normalizing.
    const product = (value.significand * factor) >> (2n * wordBits);
    value = normalize(product, value.exponent + exponent - significandBits);
  }
  return value;
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
  // EDU30.SV discards the smaller operand when the exponent gap exceeds 24 (01625–01642).
  const b = operator === '+' ? right.significand : -right.significand;
  if (b === 0n) return left;
  const gap = left.exponent - right.exponent;
  if (left.significand === 0n || gap < -2 * Number(wordBits))
    return {significand: b, exponent: right.exponent};
  if (gap > 2 * Number(wordBits)) return left;

  // The alignment routines at 01662 and 02000 shift through one extra word.
  const exponent = Math.max(left.exponent, right.exponent);
  const a = (left.significand << wordBits) >> BigInt(exponent - left.exponent);
  const alignedB = (b << wordBits) >> BigInt(exponent - right.exponent);
  return normalize(a + alignedB, exponent - significandBits - Number(wordBits));
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
