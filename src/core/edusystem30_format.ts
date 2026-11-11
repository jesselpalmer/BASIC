import {
  eduSystem30Absolute,
  eduSystem30FromNumber,
  eduSystem30Integer,
  evaluateEduSystem30Arithmetic,
  observeEduSystem30,
  scaleEduSystem30Decimal,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';

const ten = eduSystem30FromNumber(10);
// EDU30.SV multiplies by the literal at octal 03123 before choosing a notation.
const printAdjustment = eduSystem30FromNumber(1 + 2 ** -20);

function scientific(value: EduSystem30FloatingValue): [EduSystem30FloatingValue, number] {
  // Octal 03430–03457 estimates the decimal scale from the binary exponent
  // with the stored 12-bit approximation of log10(2).
  const log10OfTwo = 0o2321 / 4096;
  const binaryExponent = value.exponent;
  let places =
    binaryExponent < 0
      ? Math.floor((1 - binaryExponent) * log10OfTwo)
      : -Math.floor(binaryExponent * log10OfTwo) - 1;
  let scaled = scaleEduSystem30Decimal(value, places);
  while (scaled.exponent <= 0) {
    scaled = evaluateEduSystem30Arithmetic('*', scaled, ten);
    places++;
  }
  return [scaled, -places];
}

/** Format a stored EDU30 number, including its sign column and trailing space. */
export function formatEduSystem30Number(value: EduSystem30FloatingValue): string {
  if (value.significand === 0n) return ' 0 ';
  let magnitude = evaluateEduSystem30Arithmetic('*', eduSystem30Absolute(value), printAdjustment);
  let suffix = '';
  if (magnitude.exponent < -2 || magnitude.exponent > 20) {
    const [scaled, exponent] = scientific(magnitude);
    magnitude = scaled;
    suffix = `E${exponent}`;
  }

  const integer = eduSystem30Integer(magnitude);
  const whole = integer.significand === 0n ? '' : String(observeEduSystem30(integer));
  let remainder = evaluateEduSystem30Arithmetic('-', magnitude, integer);
  let fraction = '';
  // The archived PRINT loop ends when the binary exponent of the remainder
  // is at most 3 * emitted digits - 18.
  while (
    remainder.significand !== 0n &&
    remainder.exponent > 3 * (whole.length + fraction.length) - 18
  ) {
    remainder = evaluateEduSystem30Arithmetic('*', remainder, ten);
    const digit = eduSystem30Integer(remainder);
    fraction += String(observeEduSystem30(digit));
    remainder = evaluateEduSystem30Arithmetic('-', remainder, digit);
  }
  const sign = value.significand < 0n ? '-' : ' ';
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}${suffix} `;
}
