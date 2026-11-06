/** Internal exact host-value injection; source conversion has a different contract. */
export type BasicPlusMa2InjectionResult =
  | Readonly<{kind: 'value'; words: readonly [number, number]}>
  | Readonly<{kind: 'unsupported'; reason: 'non-finite' | 'range' | 'precision'}>;

function unsupported(reason: 'non-finite' | 'range' | 'precision'): BasicPlusMa2InjectionResult {
  return Object.freeze({kind: 'unsupported', reason});
}

export function injectBasicPlusMa2(value: number): BasicPlusMa2InjectionResult {
  if (typeof value !== 'number') throw new TypeError('MA2 injection requires a primitive number');
  if (!Number.isFinite(value)) return unsupported('non-finite');
  if (value === 0) return Object.freeze({kind: 'value', words: Object.freeze([0, 0] as const)});
  const buffer = new DataView(new ArrayBuffer(8));
  buffer.setFloat64(0, value);
  const bits = buffer.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n) - 1023 + 129;
  const fraction = bits & ((1n << 52n) - 1n);
  const maximumFraction = ((1n << 23n) - 1n) << 29n;
  if (exponent < 1 || exponent > 255 || (exponent === 255 && fraction > maximumFraction))
    return unsupported('range');
  if ((fraction & ((1n << 29n) - 1n)) !== 0n) return unsupported('precision');
  const ma2Fraction = Number(fraction >> 29n);
  const words: readonly [number, number] = Object.freeze([
    Number(bits >> 63n) * 32768 + exponent * 128 + Math.floor(ma2Fraction / 65536),
    ma2Fraction % 65536,
  ]);
  return Object.freeze({kind: 'value', words});
}
