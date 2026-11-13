import {
  compareEduSystem30,
  eduSystem30Absolute,
  eduSystem30FromNumber,
  eduSystem30Integer,
  evaluateEduSystem30Arithmetic,
  observeEduSystem30,
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

// EDU30.SV octal 03056–03074, in the order the rational approximation uses them.
const expScale = {exponent: 1, significand: 0o27052435n};
const expRatioOffset = {exponent: 7, significand: 0o25665341n};
const expRatioNumerator = {exponent: 10, significand: -0o23237435n};
const expOffset = {exponent: 4, significand: 0o23721402n};
const expCorrection = {exponent: -4, significand: 0o21575157n};
const minimumExpMagnitude = eduSystem30FromNumber(2 ** -1000);
const maximumExpMagnitude = eduSystem30FromNumber(700);

/** Reproduce the archived EXP range reduction and approximation at octal 03001–03055. */
export function eduSystem30Exponential(value: EduSystem30FloatingValue): EduSystem30FloatingValue {
  if (value.significand === 0n) return one;
  const magnitude = eduSystem30Absolute(value);
  if (
    compareEduSystem30(magnitude, minimumExpMagnitude) < 0 ||
    compareEduSystem30(magnitude, maximumExpMagnitude) > 0
  )
    throw new RangeError('EDUSYSTEM-30 EXP accepts zero or magnitudes from 2^-1000 through 700');

  const scaled = evaluateEduSystem30Arithmetic('*', magnitude, expScale);
  const integer = eduSystem30Integer(scaled);
  const integerPart = observeEduSystem30(integer);
  const fraction = evaluateEduSystem30Arithmetic('-', scaled, integer);
  const square = evaluateEduSystem30Arithmetic('*', fraction, fraction);
  const ratioDivisor = evaluateEduSystem30Arithmetic('+', square, expRatioOffset);
  const ratio = evaluateEduSystem30Arithmetic('/', expRatioNumerator, ratioDivisor);
  const adjustedRatio = evaluateEduSystem30Arithmetic('-', ratio, fraction);
  const rational = evaluateEduSystem30Arithmetic('+', adjustedRatio, expOffset);
  const correction = evaluateEduSystem30Arithmetic('*', expCorrection, square);
  const divisor = evaluateEduSystem30Arithmetic('+', correction, rational);
  const quotient = evaluateEduSystem30Arithmetic('/', fraction, divisor);
  const fractionPower = evaluateEduSystem30Arithmetic('+', one, {
    significand: quotient.significand,
    exponent: quotient.exponent + 1,
  });
  const result = {...fractionPower, exponent: fractionPower.exponent + integerPart};
  return value.significand < 0n ? evaluateEduSystem30Arithmetic('/', one, result) : result;
}

// EDU30.SV octal 03333–03365. The Horner coefficients run from highest to lowest.
const logCoefficients: readonly EduSystem30FloatingValue[] = [
  {exponent: -7, significand: -0o32336043n},
  {exponent: -4, significand: 0o22364304n},
  {exponent: -3, significand: -0o30317007n},
  {exponent: -2, significand: 0o25353301n},
  {exponent: -2, significand: -0o36640567n},
  {exponent: -1, significand: 0o25170307n},
  {exponent: -1, significand: -0o37773700n},
  {exponent: 0, significand: 0o37777742n},
];
const logTwo = {exponent: 0, significand: 0o26134414n};

/** Reproduce the archived magnitude reduction and polynomial at octal 03243–03331. */
export function eduSystem30Logarithm(value: EduSystem30FloatingValue): EduSystem30FloatingValue {
  if (value.significand === 0n)
    throw new RangeError('EDUSYSTEM-30 LOG requires a nonzero argument');

  const magnitude = eduSystem30Absolute(value);
  const reciprocal = compareEduSystem30(magnitude, one) < 0;
  const reduced = reciprocal ? evaluateEduSystem30Arithmetic('/', one, magnitude) : magnitude;
  const fraction = evaluateEduSystem30Arithmetic('-', {...reduced, exponent: 1}, one);
  let polynomial = logCoefficients[0];
  for (const coefficient of logCoefficients.slice(1)) {
    const product = evaluateEduSystem30Arithmetic('*', polynomial, fraction);
    polynomial = evaluateEduSystem30Arithmetic('+', product, coefficient);
  }
  const fractionLog = evaluateEduSystem30Arithmetic('*', polynomial, fraction);
  const integer = eduSystem30FromNumber(reduced.exponent - 1);
  const scaleLog = evaluateEduSystem30Arithmetic('*', integer, logTwo);
  const result = evaluateEduSystem30Arithmetic('+', fractionLog, scaleLog);
  return reciprocal ? {...result, significand: -result.significand} : result;
}
