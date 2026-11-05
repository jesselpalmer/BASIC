import {numericLiteral} from '../core/numeric_literal.ts';

export type HistoricalNumericSpelling = Readonly<{
  kind: 'integer' | 'whole' | 'floating';
  raw: string;
}>;

/** Internal lexical facts only; whole spelling does not select arithmetic mode. */
export function historicalNumericSpelling(raw: string): HistoricalNumericSpelling {
  if (typeof raw !== 'string') throw new TypeError('Expected a numeric spelling');
  if (/^\d+%$/.test(raw)) {
    const digits = raw.slice(0, -1).replace(/^0+/, '');
    if (digits.length > 5 || (digits.length === 5 && digits > '32767'))
      throw new RangeError('Historical integer literal range is unsupported');
    return Object.freeze({kind: 'integer', raw});
  }
  if (raw.includes('e') || !numericLiteral.test(raw))
    throw new SyntaxError('Invalid historical numeric spelling');
  return Object.freeze({kind: /^\d+$/.test(raw) ? 'whole' : 'floating', raw});
}
