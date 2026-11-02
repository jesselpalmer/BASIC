/** Internal complete unsigned MA2 literal spellings; no READ/VAL/input policy. */
import {basicPlusMa2Arithmetic} from './basic_plus_ma2.ts';

type Words = readonly [number, number];
export type BasicPlusMa2DecimalResult =
  | Readonly<{kind: 'value'; words: Words}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'input-limit' | 'conversion-status' | 'numeric-event';
    }>;

const spelling = /^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/;
const digits: readonly Words[] = [
  [0, 0],
  [0x4080, 0],
  [0x4100, 0],
  [0x4140, 0],
  [0x4180, 0],
  [0x41a0, 0],
  [0x41c0, 0],
  [0x41e0, 0],
  [0x4200, 0],
  [0x4210, 0],
];
// Stored words at 077316..077374 in the pinned loader, not host-computed powers.
const positivePowers: readonly Words[] = [
  [0o41040, 0],
  [0o41710, 0],
  [0o43434, 0o40000],
  [0o46676, 0o136040],
  [0o55416, 0o15712],
  [0o72635, 0o142656],
];
const negativePowers: readonly Words[] = [
  [0o37314, 0o146315],
  [0o36443, 0o153412],
  [0o34721, 0o133427],
  [0o31453, 0o146167],
  [0o22746, 0o112625],
  [0o5517, 0o130437],
];

function unsupported(
  reason: Extract<BasicPlusMa2DecimalResult, {kind: 'unsupported'}>['reason'],
): BasicPlusMa2DecimalResult {
  return Object.freeze({kind: 'unsupported', reason});
}

function value(words: Words): BasicPlusMa2DecimalResult {
  return Object.freeze({kind: 'value', words: Object.freeze([words[0], words[1]] as const)});
}

export function basicPlusMa2DecimalLiteral(raw: string): BasicPlusMa2DecimalResult {
  if (typeof raw !== 'string') throw new TypeError('Expected a decimal literal spelling');
  if (raw.length > 255) return unsupported('input-limit');
  if (!spelling.test(raw)) throw new SyntaxError('Expected a complete unsigned MA2 literal');
  const [mantissa, exponent] = raw.split('E');
  let words: Words = [0, 0];
  let count = 0;
  let fractional = false;
  let started = false;
  let scale = 0;
  for (let index = 0; index < mantissa.length; index++) {
    const character = mantissa[index];
    if (character === '.') {
      fractional = true;
      continue;
    }
    const digit = mantissa.charCodeAt(index) - 48;
    if (!started && digit === 0) {
      if (fractional) scale--;
      continue;
    }
    if (fractional && count >= 7) continue;
    if (fractional) scale--;
    count++;
    const multiplied = basicPlusMa2Arithmetic(words, 'multiply', positivePowers[0]);
    if (multiplied.kind !== 'value') return unsupported('numeric-event');
    const added = basicPlusMa2Arithmetic(multiplied.words, 'add', digits[digit]);
    if (added.kind !== 'value') return unsupported('numeric-event');
    words = added.words;
    started = true;
  }
  // Only the bounded signed exponent passes through Number, never the mantissa.
  // ATOF validates this word and its addition before the all-zero shortcut.
  const explicit = exponent === undefined ? 0 : Number(exponent);
  if (explicit < -32768 || explicit > 32767) return unsupported('conversion-status');
  scale += explicit;
  if (scale < -32768 || scale > 32767) return unsupported('conversion-status');
  if (!started) return value(words);
  if (Math.abs(scale) > 38) return unsupported('conversion-status');
  const powers = scale < 0 ? negativePowers : positivePowers;
  let remaining = Math.abs(scale);
  let bit = 0;
  while (remaining !== 0) {
    if (remaining % 2 !== 0) {
      const multiplied = basicPlusMa2Arithmetic(words, 'multiply', powers[bit]);
      if (multiplied.kind !== 'value') return unsupported('numeric-event');
      words = multiplied.words;
    }
    remaining = Math.floor(remaining / 2);
    bit++;
  }
  return value(words);
}
