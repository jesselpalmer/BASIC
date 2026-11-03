/** Internal bounded conversion facts; execution owns trapping and READ commits. */
import {
  basicPlusMa2DecimalLiteral,
  isBasicPlusMa2DecimalSpelling,
} from './basic_plus_ma2_decimal.ts';

type UnsupportedReason =
  | 'input-limit'
  | 'byte-domain'
  | 'lowercase'
  | 'point-only'
  | 'read-numeric-event'
  | 'failure-order';
type Unsupported = Readonly<{kind: 'unsupported'; reason: UnsupportedReason}>;
type Failure = Readonly<{kind: 'error'; code: 48 | 52}>;
type Floating = Readonly<{kind: 'value'; words: readonly [number, number]}>;
export type BasicPlusMa2ValResult = Floating | Failure | Unsupported;
export type BasicPlusMa2ReadNumericResult =
  | Readonly<{kind: 'value'; numericKind: 'floating'; words: readonly [number, number]}>
  | Readonly<{kind: 'value'; numericKind: 'integer'; value: number}>
  | Failure
  | Unsupported;

function unsupported(reason: UnsupportedReason): Unsupported {
  return Object.freeze({kind: 'unsupported', reason});
}
function failure(code: 48 | 52): Failure {
  return Object.freeze({kind: 'error', code});
}
function textBoundary(text: string): Unsupported | null {
  if (typeof text !== 'string') throw new TypeError('MA2 conversion requires primitive text');
  if (text.length > 255) return unsupported('input-limit');
  for (let index = 0; index < text.length; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) return unsupported('byte-domain');
  }
  return null;
}
function floating(text: string, caller: 'val' | 'read'): BasicPlusMa2ValResult {
  if (/[a-z]/.test(text)) return unsupported('lowercase');
  const negative = text[0] === '-';
  const raw = text[0] === '+' || negative ? text.slice(1) : text;
  if (raw === '.') return unsupported('point-only');
  if (!isBasicPlusMa2DecimalSpelling(raw)) {
    // Do not guess which failure wins when a malformed suffix follows an
    // overflowing numeric prefix. This prefix is never accepted as a value.
    const prefix = /^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/.exec(raw)?.[0];
    if (prefix !== undefined) {
      const probe = basicPlusMa2DecimalLiteral(prefix);
      if (probe.kind === 'unsupported' && probe.reason === 'numeric-event')
        return unsupported('failure-order');
    }
    return failure(52);
  }
  const converted = basicPlusMa2DecimalLiteral(raw);
  if (converted.kind === 'unsupported') {
    if (converted.reason === 'conversion-status') return failure(52);
    // The text boundary already imposed the same source converter length cap.
    return caller === 'val' ? failure(48) : unsupported('read-numeric-event');
  }
  const [high, low] = converted.words;
  // Conversion supplied a positive canonical value; keep canonical zero unsigned.
  const words: readonly [number, number] = Object.freeze([
    negative && high !== 0 ? high + 32768 : high,
    low,
  ]);
  return Object.freeze({kind: 'value', words});
}

export function basicPlusMa2Val(text: string): BasicPlusMa2ValResult {
  const boundary = textBoundary(text);
  if (boundary !== null) return boundary;
  const normalized = text.replaceAll(' ', '');
  if (normalized === '')
    return Object.freeze({kind: 'value', words: Object.freeze([0, 0] as const)});
  return floating(normalized, 'val');
}

export function basicPlusMa2ReadNumeric(
  text: string,
  target: 'floating' | 'integer',
  quoted: boolean,
): BasicPlusMa2ReadNumericResult {
  if (target !== 'floating' && target !== 'integer')
    throw new RangeError('Unsupported numeric READ target');
  if (typeof quoted !== 'boolean')
    throw new TypeError('Numeric READ requires an explicit quoted flag');
  const boundary = textBoundary(text);
  if (boundary !== null) return boundary;
  if (quoted) return failure(52);
  if (text === '' || text.includes(' '))
    throw new RangeError('Expected nonempty scanned unquoted DATA text');
  if (/[a-z]/.test(text)) return unsupported('lowercase');
  if (target === 'floating') {
    const converted = floating(text, 'read');
    return converted.kind === 'value'
      ? Object.freeze({kind: 'value', numericKind: 'floating', words: converted.words})
      : converted;
  }
  if (!/^[+-]?\d+$/.test(text)) return failure(52);
  const negative = text[0] === '-';
  const start = negative || text[0] === '+' ? 1 : 0;
  const limit = negative ? 32768 : 32767;
  let value = 0;
  for (let index = start; index < text.length; index++) {
    value = value * 10 + text.charCodeAt(index) - 48;
    if (value > limit) return failure(52);
  }
  return Object.freeze({
    kind: 'value',
    numericKind: 'integer',
    value: negative && value !== 0 ? -value : value,
  });
}
