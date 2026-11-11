import {
  evaluateEduSystem30Arithmetic,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';

/** The admitted positive powers use the archive's order of stored products. */
export function eduSystem30Power(
  base: EduSystem30FloatingValue,
  exponent: number,
): EduSystem30FloatingValue {
  const square = evaluateEduSystem30Arithmetic('*', base, base);
  if (exponent === 2) return square;
  if (exponent === 3) return evaluateEduSystem30Arithmetic('*', square, base);
  const fourth = evaluateEduSystem30Arithmetic('*', square, square);
  return exponent === 4 ? fourth : evaluateEduSystem30Arithmetic('*', fourth, base);
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
