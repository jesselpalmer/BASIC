/** Internal exact word decoding; see docs/basic-plus-floating-words.md. */

export type BasicPlusFloatingValue = Readonly<{
  precision: 24 | 56;
  sign: 1 | -1;
  significand: bigint;
  binaryExponent: number;
}>;

export type BasicPlusFloatingWordResult =
  | Readonly<{kind: 'value'; value: BasicPlusFloatingValue}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'signed-zero' | 'zero-exponent-fraction';
    }>;

export function decodeBasicPlusFloatingWords(
  words: readonly number[],
): BasicPlusFloatingWordResult {
  if (!Array.isArray(words)) {
    throw new TypeError('BASIC-PLUS floating words must be an array');
  }
  const length = words.length;
  if (length !== 2 && length !== 4) {
    throw new RangeError('BASIC-PLUS floating words require exactly two or four words');
  }
  const snapshot: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const word: unknown = words[index];
    if (typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > 65535) {
      throw new RangeError('BASIC-PLUS floating word must be an integer in 0..65535');
    }
    snapshot.push(word);
  }

  const precision = length === 2 ? 24 : 56;
  const first = snapshot[0];
  const sign = first >= 32768 ? -1 : 1;
  const storedExponent = Math.floor(first / 128) % 256;
  let fraction = BigInt(first % 128);
  for (let index = 1; index < length; index += 1) {
    fraction = fraction * 65536n + BigInt(snapshot[index]);
  }
  if (storedExponent === 0) {
    if (fraction !== 0n) {
      return Object.freeze({kind: 'unsupported', reason: 'zero-exponent-fraction'});
    }
    if (sign === -1) return Object.freeze({kind: 'unsupported', reason: 'signed-zero'});
    return Object.freeze({
      kind: 'value',
      value: Object.freeze({precision, sign, significand: 0n, binaryExponent: 0}),
    });
  }
  return Object.freeze({
    kind: 'value',
    value: Object.freeze({
      precision,
      sign,
      significand: (1n << BigInt(precision - 1)) + fraction,
      binaryExponent: storedExponent - 128 - precision,
    }),
  });
}
