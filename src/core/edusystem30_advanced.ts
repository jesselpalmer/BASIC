import {
  eduSystem30FromNumber,
  evaluateEduSystem30Arithmetic,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';

const one = eduSystem30FromNumber(1);

/** Apply the archived least-significant-bit-first order of stored products. */
export function eduSystem30Power(
  base: EduSystem30FloatingValue,
  exponent: number,
): EduSystem30FloatingValue {
  let result = one;
  let factor = base;
  for (let remaining = exponent; remaining > 0; remaining >>= 1) {
    if (remaining & 1) result = evaluateEduSystem30Arithmetic('*', result, factor);
    if (remaining > 1) factor = evaluateEduSystem30Arithmetic('*', factor, factor);
  }
  return result;
}

/** Reproduce the archived positive SQR iteration at octal 2451–2535. */
export function eduSystem30SquareRoot(value: EduSystem30FloatingValue): EduSystem30FloatingValue {
  if (value.significand === 0n) return value;
  let estimate = {significand: 0o3015n << 12n, exponent: Math.ceil(value.exponent / 2)};
  for (;;) {
    const quotient = evaluateEduSystem30Arithmetic('/', value, estimate);
    const sum = evaluateEduSystem30Arithmetic('+', estimate, quotient);
    const next = {significand: sum.significand, exponent: sum.exponent - 1};
    const difference = next.significand - estimate.significand;
    if (
      next.exponent === estimate.exponent &&
      next.significand >> 12n === estimate.significand >> 12n &&
      difference >= -1n &&
      difference <= 1n
    )
      return next;
    estimate = next;
  }
}
