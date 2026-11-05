/** Internal raw-token/literal binding; no historical Program is executable yet. */
import {basicPlusMa2DecimalLiteral} from './basic_plus_ma2_decimal.ts';
import type {NodeOf, Location, Position, TokenOf} from './types.ts';

type Literal = NodeOf<'Ma2NumberLiteral'>;
type UnsupportedReason = 'integer-kind' | 'input-limit' | 'conversion-status' | 'numeric-event';
export type BasicPlusMa2LiteralResult =
  | Readonly<{kind: 'value'; literal: Literal}>
  | Readonly<{kind: 'unsupported'; reason: UnsupportedReason}>;

function position(value: Position): Position {
  if (value === null || typeof value !== 'object')
    throw new TypeError('Expected a literal position');
  const {line, column, offset} = value;
  if (
    !Number.isSafeInteger(line) ||
    line < 1 ||
    !Number.isSafeInteger(column) ||
    column < 1 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    throw new RangeError('Invalid literal position');
  return Object.freeze({line, column, offset});
}
function location(label: number | null, start: Position, end: Position, raw: string): Location {
  if (label !== null && (!Number.isSafeInteger(label) || label < 1 || label > 32767))
    throw new RangeError('Invalid historical literal label');
  const from = position(start),
    to = position(end);
  if (
    to.line !== from.line ||
    to.column - from.column !== raw.length ||
    to.offset - from.offset !== raw.length
  )
    throw new RangeError('Literal span must match its raw spelling');
  return Object.freeze({label, start: from, end: to});
}
function bind(raw: string, span: Location): BasicPlusMa2LiteralResult {
  if (raw.length > 255) return Object.freeze({kind: 'unsupported', reason: 'input-limit'});
  if (/^\d+%$/.test(raw)) return Object.freeze({kind: 'unsupported', reason: 'integer-kind'});
  const converted = basicPlusMa2DecimalLiteral(raw);
  if (converted.kind === 'unsupported') return converted;
  const words: readonly [number, number] = Object.freeze([converted.words[0], converted.words[1]]);
  return Object.freeze({
    kind: 'value',
    literal: Object.freeze({type: 'Ma2NumberLiteral', raw, words, location: span}),
  });
}
export function prepareBasicPlusMa2Literal(
  token: TokenOf<'RAW_NUMBER'>,
): BasicPlusMa2LiteralResult {
  if (token === null || typeof token !== 'object')
    throw new TypeError('Expected a raw numeric token');
  const {type, value, raw, label, start, end} = token;
  if (type !== 'RAW_NUMBER' || value !== null || typeof raw !== 'string')
    throw new TypeError('Expected a raw numeric token');
  return bind(raw, location(label, start, end, raw));
}
export function validateBasicPlusMa2Literal(node: Literal): BasicPlusMa2LiteralResult {
  if (node === null || typeof node !== 'object') throw new TypeError('Expected a MA2 literal');
  const {type, raw, location: suppliedLocation} = node;
  if (
    type !== 'Ma2NumberLiteral' ||
    typeof raw !== 'string' ||
    suppliedLocation === null ||
    typeof suppliedLocation !== 'object'
  )
    throw new TypeError('Expected a MA2 literal');
  const {label, start, end} = suppliedLocation;
  const prepared = bind(raw, location(label, start, end, raw));
  if (prepared.kind === 'unsupported') return prepared;
  const words = node.words;
  if (!Array.isArray(words)) throw new TypeError('MA2 literal words must be an array');
  if (words.length !== 2) throw new RangeError('MA2 literal requires exactly two words');
  const snapshot: number[] = [];
  for (let index = 0; index < 2; index++) {
    const word: unknown = words[index];
    if (typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > 65535)
      throw new RangeError('Invalid MA2 literal word');
    snapshot.push(word);
  }
  if (snapshot[0] !== prepared.literal.words[0] || snapshot[1] !== prepared.literal.words[1])
    throw new RangeError('MA2 literal words disagree with raw conversion');
  return prepared;
}
