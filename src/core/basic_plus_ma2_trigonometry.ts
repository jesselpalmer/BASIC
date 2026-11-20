/** The selected software MA2 range reduction and sine polynomial. */
import {basicPlusMa2Arithmetic, type BasicPlusMa2Result} from './basic_plus_ma2.ts';
import {
  basicPlusMa2Unary,
  observeBasicPlusMa2,
  type BasicPlusMa2UnaryResult,
} from './basic_plus_ma2_values.ts';

type Words = readonly [number, number];
export type BasicPlusMa2TrigonometricOperation = 'sine' | 'cosine' | 'tangent';
export type BasicPlusMa2TrigonometricResult =
  BasicPlusMa2Result | Extract<BasicPlusMa2UnaryResult, {kind: 'unsupported'}>;
const one: Words = Object.freeze([0o40200, 0]);
const halfPi: Words = Object.freeze([0o40311, 0o7733]);
const fullTurn: Words = Object.freeze([0o40711, 0o7733]);
const coefficients: readonly Words[] = Object.freeze([
  Object.freeze([0o35036, 0o153672] as const),
  Object.freeze([0o136231, 0o23143] as const),
  Object.freeze([0o37243, 0o32130] as const),
  Object.freeze([0o140045, 0o56741] as const),
  halfPi,
]);

function value(words: Words): Extract<BasicPlusMa2Result, {kind: 'value'}> {
  return Object.freeze({kind: 'value', words: Object.freeze([words[0], words[1]] as const)});
}

function sine(input: Words): BasicPlusMa2Result {
  const negative = (input[0] & 32768) !== 0;
  const reduced = basicPlusMa2Arithmetic([input[0] & 32767, input[1]], 'divide', fullTurn);
  if (reduced.kind !== 'value') return reduced;
  const wholeTurns = basicPlusMa2Unary(reduced.words, 'integer');
  if (wholeTurns.kind !== 'value') throw new Error('Expected a canonical MA2 reduction');
  const remainder = basicPlusMa2Arithmetic(reduced.words, 'subtract', wholeTurns.words);
  if (remainder.kind !== 'value') return remainder;
  if (remainder.words[0] === 0) return value([negative ? 32768 : 0, 0]);
  let fraction = remainder.words;

  // The machine increments the stored exponent by two before truncating the
  // quadrant. Multiplication by four here is an exact exponent adjustment.
  const fourFractions: Words = [fraction[0] + 256, fraction[1]];
  const quadrantWords = basicPlusMa2Unary(fourFractions, 'integer');
  if (quadrantWords.kind !== 'value') throw new Error('Expected a canonical MA2 quadrant');
  const observed = observeBasicPlusMa2(quadrantWords.words);
  if (observed.kind !== 'value') throw new Error('Expected a bounded MA2 quadrant');
  const quadrant = observed.value;
  const withinQuadrant = basicPlusMa2Arithmetic(fourFractions, 'subtract', quadrantWords.words);
  if (withinQuadrant.kind !== 'value') return withinQuadrant;
  const folded =
    quadrant % 2 === 1
      ? basicPlusMa2Arithmetic(one, 'subtract', withinQuadrant.words)
      : withinQuadrant;
  if (folded.kind !== 'value') return folded;
  fraction = folded.words;

  const square = basicPlusMa2Arithmetic(fraction, 'multiply', fraction);
  if (square.kind !== 'value') return square;
  let polynomial = coefficients[0];
  for (let index = 1; index < coefficients.length; index++) {
    const product = basicPlusMa2Arithmetic(square.words, 'multiply', polynomial);
    if (product.kind !== 'value') return product;
    const sum = basicPlusMa2Arithmetic(product.words, 'add', coefficients[index]);
    if (sum.kind !== 'value') return sum;
    polynomial = sum.words;
  }
  const product = basicPlusMa2Arithmetic(fraction, 'multiply', polynomial);
  if (product.kind !== 'value') return product;
  const result = product.words;
  const negativeResult = quadrant >= 2 ? !negative : negative;
  return value(
    result[0] === 0
      ? [negative ? 32768 : 0, 0]
      : negativeResult
        ? [result[0] ^ 32768, result[1]]
        : result,
  );
}

function cosine(input: Words): BasicPlusMa2Result {
  // COS adds the stored half-pi to the signed operand before SIN takes ABS.
  const shifted = basicPlusMa2Arithmetic(input, 'add', halfPi);
  return shifted.kind === 'value' ? sine(shifted.words) : shifted;
}

function canonicalResult(result: BasicPlusMa2Result): BasicPlusMa2TrigonometricResult {
  if (result.kind !== 'value') return result;
  const checked = basicPlusMa2Unary(result.words, 'absolute');
  return checked.kind === 'value' ? result : checked;
}

function arithmeticZero(words: Words): Words {
  // The original divide recognizes an exponent-zero operand before inspecting
  // its sign. Preserve that behavior inside TAN while rejecting a signed-zero
  // result at the selected value boundary.
  return words[0] === 32768 && words[1] === 0 ? [0, 0] : words;
}

export function basicPlusMa2Trigonometry(
  input: readonly number[],
  operation: BasicPlusMa2TrigonometricOperation,
): BasicPlusMa2TrigonometricResult {
  if (operation !== 'sine' && operation !== 'cosine' && operation !== 'tangent')
    throw new RangeError('Unsupported MA2 trigonometric operation');
  if (!Array.isArray(input)) throw new TypeError('MA2 words must be an array');
  const length = input.length;
  if (length !== 2 && length !== 4) throw new RangeError('Expected two or four MA2 words');
  const snapshot: number[] = [];
  for (let index = 0; index < length; index++) {
    const word: unknown = input[index];
    if (typeof word !== 'number') throw new RangeError('Invalid MA2 word');
    snapshot.push(word);
  }
  const validated = basicPlusMa2Unary(snapshot, 'absolute');
  if (validated.kind !== 'value') return validated;
  const words: Words = [snapshot[0], snapshot[1]];
  if (operation === 'sine') return canonicalResult(sine(words));
  if (operation === 'cosine') return canonicalResult(cosine(words));
  const numerator = sine(words);
  if (numerator.kind !== 'value') return numerator;
  const denominator = cosine(words);
  if (denominator.kind !== 'value') return denominator;
  return basicPlusMa2Arithmetic(
    arithmeticZero(numerator.words),
    'divide',
    arithmeticZero(denominator.words),
  );
}
