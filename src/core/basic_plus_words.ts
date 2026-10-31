/** Internal October 1972 BASIC-PLUS word rules; not a public dialect selection. */

export const BASIC_PLUS_WORD_MINIMUM = -32768;
export const BASIC_PLUS_WORD_MAXIMUM = 32767;

const wordModulus = 65536;
const signBit = 32768;

export type BasicPlusWordUnsupportedReason =
  'assignment-boundary' | 'division-by-zero' | 'division-overflow' | 'minimum-word-negation';

export type BasicPlusWordResult =
  | Readonly<{kind: 'value'; value: number}>
  | Readonly<{kind: 'unsupported'; reason: BasicPlusWordUnsupportedReason}>;

export type BasicPlusWordArithmeticOperator = 'add' | 'subtract' | 'multiply' | 'divide';
export type BasicPlusWordLogicalOperator = 'and' | 'or' | 'xor' | 'imp' | 'eqv';

function result(value: number): BasicPlusWordResult {
  return Object.freeze({kind: 'value', value});
}

function unsupported(reason: BasicPlusWordUnsupportedReason): BasicPlusWordResult {
  return Object.freeze({kind: 'unsupported', reason});
}

function requireWord(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < BASIC_PLUS_WORD_MINIMUM ||
    value > BASIC_PLUS_WORD_MAXIMUM
  ) {
    throw new RangeError('BASIC-PLUS word operand must be an integer in -32768..32767');
  }
  return value;
}

function unsignedWord(value: number): number {
  return value < 0 ? value + wordModulus : value;
}

function signedWord(value: number): number {
  const normalized = ((value % wordModulus) + wordModulus) % wordModulus;
  return normalized >= signBit ? normalized - wordModulus : normalized;
}

export function basicPlusWordAssignment(value: number): BasicPlusWordResult {
  if (!Number.isFinite(value)) {
    throw new RangeError('BASIC-PLUS assignment input must be finite');
  }
  const truncated = Math.trunc(value);
  if (truncated < BASIC_PLUS_WORD_MINIMUM || truncated > BASIC_PLUS_WORD_MAXIMUM) {
    return unsupported('assignment-boundary');
  }
  return result(Object.is(truncated, -0) ? 0 : truncated);
}

export function basicPlusWordArithmetic(
  left: number,
  operator: BasicPlusWordArithmeticOperator,
  right: number,
): BasicPlusWordResult {
  requireWord(left);
  requireWord(right);
  switch (operator) {
    case 'add':
      return result(signedWord(left + right));
    case 'subtract':
      return result(signedWord(left - right));
    case 'multiply':
      // Bounded word products are exact in binary64; normalize before sign decoding.
      return result(signedWord(left * right));
    case 'divide':
      if (right === 0) return unsupported('division-by-zero');
      if (left === BASIC_PLUS_WORD_MINIMUM && right === -1) {
        return unsupported('division-overflow');
      }
      return result(Math.trunc(left / right));
    default:
      throw new RangeError('Unsupported BASIC-PLUS word arithmetic operator');
  }
}

export function basicPlusWordNegate(value: number): BasicPlusWordResult {
  requireWord(value);
  return value === BASIC_PLUS_WORD_MINIMUM ? unsupported('minimum-word-negation') : result(-value);
}

export function basicPlusWordNot(value: number): BasicPlusWordResult {
  requireWord(value);
  return result(signedWord(wordModulus - 1 - unsignedWord(value)));
}

export function basicPlusWordLogical(
  left: number,
  operator: BasicPlusWordLogicalOperator,
  right: number,
): BasicPlusWordResult {
  requireWord(left);
  requireWord(right);
  const leftPattern = unsignedWord(left);
  const rightPattern = unsignedWord(right);
  let pattern = 0;
  for (let bit = 1; bit < wordModulus; bit *= 2) {
    const leftSet = Math.floor(leftPattern / bit) % 2 === 1;
    const rightSet = Math.floor(rightPattern / bit) % 2 === 1;
    let set: boolean;
    switch (operator) {
      case 'and':
        set = leftSet && rightSet;
        break;
      case 'or':
        set = leftSet || rightSet;
        break;
      case 'xor':
        set = leftSet !== rightSet;
        break;
      case 'imp':
        set = !leftSet || rightSet;
        break;
      case 'eqv':
        set = leftSet === rightSet;
        break;
      default:
        throw new RangeError('Unsupported BASIC-PLUS word logical operator');
    }
    if (set) pattern += bit;
  }
  // Both operands already occupy exactly 16 bits; each result stays in that word.
  return result(signedWord(pattern));
}

export function basicPlusWordRelation(value: boolean): -1 | 0 {
  if (typeof value !== 'boolean') {
    throw new TypeError('BASIC-PLUS relation result must be a boolean');
  }
  return value ? -1 : 0;
}

export function basicPlusWordCondition(value: number): boolean {
  requireWord(value);
  return value !== 0;
}
