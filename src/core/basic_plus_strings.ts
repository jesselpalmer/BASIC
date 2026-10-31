/** Internal October 1972 string conformance; no public profile activation. */
import {basicPlusWordRelation} from './basic_plus_words.ts';
import type {ComparisonOperator} from './types.ts';

export const BASIC_PLUS_STRING_LIMIT = 32767;

export type BasicPlusStringUnsupportedReason =
  | 'string-limit'
  | 'character-domain'
  | 'index-domain'
  | 'empty-ascii'
  | 'empty-pattern'
  | 'comparison-domain';

export type BasicPlusStringResult<T extends string | number> =
  | Readonly<{kind: 'value'; value: T}>
  | Readonly<{kind: 'unsupported'; reason: BasicPlusStringUnsupportedReason}>;

function value<T extends string | number>(result: T): BasicPlusStringResult<T> {
  return Object.freeze({kind: 'value', value: result});
}

function unsupported(reason: BasicPlusStringUnsupportedReason) {
  return Object.freeze({kind: 'unsupported' as const, reason});
}

function stringProblem(source: string): BasicPlusStringUnsupportedReason | null {
  if (typeof source !== 'string') throw new TypeError('Expected a BASIC-PLUS string');
  if (source.length > BASIC_PLUS_STRING_LIMIT) return 'string-limit';
  for (let index = 0; index < source.length; index++)
    if (source.charCodeAt(index) > 255) return 'character-domain';
  return null;
}

function requireNumber(input: number) {
  if (typeof input !== 'number') throw new TypeError('Expected a BASIC-PLUS numeric argument');
}

function positiveIndex(input: number, maximum: number): boolean {
  requireNumber(input);
  return Number.isInteger(input) && input >= 1 && input <= maximum;
}

export function basicPlusStringLength(source: string): BasicPlusStringResult<number> {
  const problem = stringProblem(source);
  return problem ? unsupported(problem) : value(source.length);
}

export function basicPlusStringLeft(source: string, count: number): BasicPlusStringResult<string> {
  const problem = stringProblem(source);
  requireNumber(count);
  if (problem) return unsupported(problem);
  if (!positiveIndex(count, source.length)) return unsupported('index-domain');
  return value(source.slice(0, count));
}

export function basicPlusStringRight(source: string, start: number): BasicPlusStringResult<string> {
  const problem = stringProblem(source);
  requireNumber(start);
  if (problem) return unsupported(problem);
  if (!positiveIndex(start, source.length)) return unsupported('index-domain');
  return value(source.slice(start - 1));
}

export function basicPlusStringMid(
  source: string,
  start: number,
  count: number,
): BasicPlusStringResult<string> {
  const problem = stringProblem(source);
  requireNumber(start);
  requireNumber(count);
  if (problem) return unsupported(problem);
  if (!positiveIndex(start, source.length) || !positiveIndex(count, source.length - start + 1))
    return unsupported('index-domain');
  return value(source.slice(start - 1, start - 1 + count));
}

export function basicPlusStringAscii(source: string): BasicPlusStringResult<number> {
  const problem = stringProblem(source);
  if (problem) return unsupported(problem);
  return source.length === 0 ? unsupported('empty-ascii') : value(source.charCodeAt(0));
}

export function basicPlusStringCharacter(code: number): BasicPlusStringResult<string> {
  requireNumber(code);
  if (!Number.isInteger(code) || code < 0 || code > 255) return unsupported('character-domain');
  return value(String.fromCharCode(code));
}

export function basicPlusStringSpace(count: number): BasicPlusStringResult<string> {
  requireNumber(count);
  if (!Number.isInteger(count) || count < 0) return unsupported('index-domain');
  if (count > BASIC_PLUS_STRING_LIMIT) return unsupported('string-limit');
  return value(' '.repeat(count));
}

export function basicPlusStringSearch(
  start: number,
  source: string,
  pattern: string,
): BasicPlusStringResult<number> {
  requireNumber(start);
  // Validate both operands completely, even when a match would occur earlier.
  const sourceProblem = stringProblem(source);
  const patternProblem = stringProblem(pattern);
  if (sourceProblem || patternProblem) return unsupported(sourceProblem ?? patternProblem!);
  if (pattern.length === 0) return unsupported('empty-pattern');
  if (!positiveIndex(start, source.length)) return unsupported('index-domain');
  return value(source.indexOf(pattern, start - 1) + 1);
}

function alphabeticalSubset(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if (code !== 32 && (code < 65 || code > 90)) return false;
  }
  return true;
}

/** Closed §5.1.5 subset; byte equality is broader than verified collation. */
export function basicPlusStringRelation(
  left: string,
  operator: ComparisonOperator,
  right: string,
): BasicPlusStringResult<-1 | 0> {
  if (!['=', '<>', '<', '<=', '>', '>='].includes(operator))
    throw new RangeError('Unsupported BASIC-PLUS string relation');
  const leftProblem = stringProblem(left);
  const rightProblem = stringProblem(right);
  if (leftProblem || rightProblem) return unsupported(leftProblem ?? rightProblem!);
  if (
    operator !== '=' &&
    operator !== '<>' &&
    (!alphabeticalSubset(left) || !alphabeticalSubset(right))
  )
    return unsupported('comparison-domain');

  let order = 0;
  // Conceptual ASCII-blank padding avoids allocating padded copies.
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 32;
    const rightCode = index < right.length ? right.charCodeAt(index) : 32;
    if (leftCode !== rightCode) {
      order = leftCode < rightCode ? -1 : 1;
      break;
    }
  }
  let holds: boolean;
  switch (operator) {
    case '=':
      holds = order === 0;
      break;
    case '<>':
      holds = order !== 0;
      break;
    case '<':
      holds = order < 0;
      break;
    case '<=':
      holds = order <= 0;
      break;
    case '>':
      holds = order > 0;
      break;
    case '>=':
      holds = order >= 0;
      break;
  }
  return value(basicPlusWordRelation(holds));
}
