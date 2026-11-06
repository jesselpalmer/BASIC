/** Closed internal numeric values; execution owns storage and event handling. */
import {decodeBasicPlusFloatingWords} from './basic_plus_floating_words.ts';
import {
  basicPlusMa2Arithmetic,
  type BasicPlusMa2Operation,
  type BasicPlusMa2Result,
} from './basic_plus_ma2.ts';
import {
  basicPlusMa2Unary,
  compareBasicPlusMa2,
  observeBasicPlusMa2,
  type BasicPlusMa2UnaryOperation,
  type BasicPlusMa2UnaryResult,
} from './basic_plus_ma2_values.ts';
import {injectBasicPlusMa2, type BasicPlusMa2InjectionResult} from './basic_plus_ma2_injection.ts';
import {
  validateBasicPlusMa2Literal,
  type BasicPlusMa2LiteralResult,
} from './basic_plus_ma2_literal.ts';
import type {NodeOf} from './types.ts';

export type Ma2Value = Readonly<{kind: 'ma2'; words: readonly [number, number]}>;
type Value = Readonly<{kind: 'value'; value: Ma2Value}>;
type Unsupported = Readonly<{
  kind: 'unsupported';
  reason: 'four-word-precision' | 'signed-zero' | 'zero-exponent-fraction';
}>;
export type Ma2ValueResult = Value | Unsupported;
export type Ma2BinaryResult =
  | Value
  | Extract<BasicPlusMa2Result, {kind: 'unsupported'}>
  | Readonly<{
      kind: 'numeric-event';
      code: 48;
      reason: 'overflow' | 'underflow';
      continuation: Ma2Value;
    }>
  | Readonly<{kind: 'numeric-event'; code: 61; reason: 'division-by-zero'; continuation: Ma2Value}>;

function value(words: readonly [number, number]): Ma2Value {
  return Object.freeze({kind: 'ma2', words: Object.freeze([words[0], words[1]] as const)});
}
function normal(words: readonly [number, number]): Value {
  return Object.freeze({kind: 'value', value: value(words)});
}
export function bindMa2Words(words: readonly number[]): Ma2ValueResult {
  if (!Array.isArray(words)) throw new TypeError('MA2 words must be an array');
  const length = words.length;
  if (length !== 2 && length !== 4) throw new RangeError('Expected two or four floating words');
  const snapshot: number[] = [];
  for (let index = 0; index < length; index++) {
    const word: unknown = words[index];
    if (typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > 65535)
      throw new RangeError('Invalid MA2 word');
    snapshot.push(word === 0 ? 0 : word);
  }
  const decoded = decodeBasicPlusFloatingWords(snapshot);
  if (decoded.kind === 'unsupported') return decoded;
  if (decoded.value.precision !== 24)
    return Object.freeze({kind: 'unsupported', reason: 'four-word-precision'});
  return normal([snapshot[0], snapshot[1]]);
}
export function bindMa2Literal(
  literal: NodeOf<'Ma2NumberLiteral'>,
): Value | Extract<BasicPlusMa2LiteralResult, {kind: 'unsupported'}> {
  const prepared = validateBasicPlusMa2Literal(literal);
  return prepared.kind === 'unsupported' ? prepared : normal(prepared.literal.words);
}
export function injectMa2Value(
  number: number,
): Value | Extract<BasicPlusMa2InjectionResult, {kind: 'unsupported'}> {
  const injected = injectBasicPlusMa2(number);
  return injected.kind === 'unsupported' ? injected : normal(injected.words);
}
function words(input: Ma2Value): readonly [number, number] {
  if (input === null || typeof input !== 'object' || input.kind !== 'ma2')
    throw new TypeError('Expected a tagged MA2 value');
  return input.words;
}
export function ma2Binary(
  left: Ma2Value,
  operation: BasicPlusMa2Operation,
  right: Ma2Value,
): Ma2BinaryResult {
  const result = basicPlusMa2Arithmetic(words(left), operation, words(right));
  if (result.kind === 'unsupported') return result;
  if (result.kind === 'value') return normal(result.words);
  const {continuationWords, ...event} = result;
  return Object.freeze({...event, continuation: value(continuationWords)});
}
export function ma2Unary(
  input: Ma2Value,
  operation: BasicPlusMa2UnaryOperation,
): Value | Extract<BasicPlusMa2UnaryResult, {kind: 'unsupported'}> {
  const result = basicPlusMa2Unary(words(input), operation);
  return result.kind === 'unsupported' ? result : normal(result.words);
}
export function compareMa2Values(left: Ma2Value, right: Ma2Value) {
  return compareBasicPlusMa2(words(left), words(right));
}
export function observeMa2Value(input: Ma2Value) {
  return observeBasicPlusMa2(words(input));
}
