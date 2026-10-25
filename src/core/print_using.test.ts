import {describe, expect, it} from 'bun:test';
import {BasicRuntimeError} from './diagnostic.ts';
import {formatPrintUsing} from './print_using.ts';
import type {BasicValue, Location} from './types.ts';

const location: Location = {
  label: 120,
  start: {line: 6, column: 14, offset: 100},
  end: {line: 6, column: 23, offset: 109},
};

function format(image: BasicValue, values: readonly BasicValue[]): string {
  return formatPrintUsing(image, values, location);
}

function failure(
  image: BasicValue,
  values: readonly BasicValue[],
  code: string,
): BasicRuntimeError {
  try {
    format(image, values);
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic).toMatchObject({code, label: 120, line: 6, column: 14, offset: 100});
    return error;
  }
  throw new Error('Expected runtime failure');
}

describe('native integer PRINT USING formatter', () => {
  it('right-justifies integer fields, consumes signs and retains surrounding literals', () => {
    // BASIC-PLUS October 1972, section 10.4.1, printed page 10-9:
    // the integer field example prints 12 in four columns. Fractions stay unsupported here.
    expect(format('####', [12])).toBe('  12');
    expect(format('A=###;B=#### END', [7, -12])).toBe('A=  7;B= -12 END');
    expect(format('# # ## ###', [0, 9, -9, -99])).toBe('0 9 -9 -99');
    expect(format('##/##', [12, 34])).toBe('12/34');
    expect(format('###', [123])).toBe('123');
    expect(format('####', [-123])).toBe('-123');
  });

  it('matches independently written 1CHECK numeric-board row expectations', () => {
    // Raw upstream 1check.bas lines 70-76; source review/provenance lives in
    // docs/classic-source-review.md. This asserts only its integer formatting slice.
    const image = '## ##  ##  ##  ##  ##  ##  ##';
    const rows: readonly (readonly [readonly number[], string])[] = [
      [[1, 2, 3, 4, 5, 6, 7, 8], ' 1  2   3   4   5   6   7   8'],
      [[9, 10, 11, 12, 13, 14, 15, 16], ' 9 10  11  12  13  14  15  16'],
      [[17, 18, 19, 20, 21, 22, 23, 24], '17 18  19  20  21  22  23  24'],
      [[25, 26, 27, 28, 29, 30, 31, 32], '25 26  27  28  29  30  31  32'],
      [[33, 34, 35, 36, 37, 38, 39, 40], '33 34  35  36  37  38  39  40'],
      [[41, 42, 43, 44, 45, 46, 47, 48], '41 42  43  44  45  46  47  48'],
      [[49, 50, 51, 52, 53, 54, 55, 56], '49 50  51  52  53  54  55  56'],
      [[57, 58, 59, 60, 61, 62, 63, 64], '57 58  59  60  61  62  63  64'],
    ];
    for (const [values, expected] of rows) expect(format(image, values)).toBe(expected);
  });

  it('keeps accepted punctuation literal and normalizes negative zero', () => {
    expect(format('A0 ()[]{}:;=/<>?@|~`"# END', [1])).toBe('A0 ()[]{}:;=/<>?@|~`"1 END');
    expect(format('##', [-0])).toBe(' 0');
    expect(format('################', [Number.MAX_SAFE_INTEGER])).toBe('9007199254740991');
    expect(format('#################', [-Number.MAX_SAFE_INTEGER])).toBe('-9007199254740991');
  });

  it('does not mutate supplied values or retain state between calls', () => {
    const values = Object.freeze([1, -2]);
    expect(format('## ## END', values)).toBe(' 1 -2 END');
    expect(values).toEqual([1, -2]);
    failure('## ##', [1, 100], 'FORMAT_OVERFLOW');
    expect(format('## ## END', values)).toBe(' 1 -2 END');
  });

  it('accepts the full image bound, including padding and trailing literals', () => {
    const padded = format('#'.repeat(4096), [1]);
    expect(padded).toBe(' '.repeat(4095) + '1');
    expect(padded.length).toBe(4096);
    expect(format('#' + 'x'.repeat(4095), [7])).toBe('7' + 'x'.repeat(4095));
    expect(format('# '.repeat(2048), Array<number>(2048).fill(0))).toBe('0 '.repeat(2048));
  });

  it('rejects image/value bounds before constructing output', () => {
    failure('#'.repeat(4097), [1], 'FORMAT_LIMIT');
    failure('#', Array<number>(4097).fill(0), 'FORMAT_LIMIT');
    // Exactly 4096 values passes the resource guard, then fails the one-pass count rule.
    failure('#', Array<number>(4096).fill(0), 'FORMAT_VALUE_COUNT');
  });

  it('requires a string image with at least one field and the exact value count', () => {
    failure(123, [1], 'TYPE_MISMATCH');
    failure('', [], 'UNSUPPORTED_FORMAT');
    failure('NO FIELDS', [1], 'UNSUPPORTED_FORMAT');
    failure('#', [], 'FORMAT_VALUE_COUNT');
    failure('## END ##', [1], 'FORMAT_VALUE_COUNT');
    failure('#', [1, 2], 'FORMAT_VALUE_COUNT');
    // A maximal # run is one field, not three single-digit fields.
    failure('###', [1, 2, 3], 'FORMAT_VALUE_COUNT');
  });

  it.each(['.', ',', '+', '-', '*', '$', '^', '!', '\\', "'", '_', '&', '%'])(
    'rejects unsupported image marker %j even outside a numeric field',
    (marker) => {
      failure(`${marker} ##`, [1], 'UNSUPPORTED_FORMAT');
      failure(`##${marker}`, [1], 'UNSUPPORTED_FORMAT');
    },
  );

  it.each(['\0', '\t', '\n', '\r', '\x1b', '\x7f', '\x80', 'é', '↑', '😀'])(
    'rejects non-printable or non-ASCII image character %j',
    (character) => {
      failure(`##${character}`, [1], 'UNSUPPORTED_FORMAT');
    },
  );

  it('validates every image character, including text after an unused field', () => {
    failure('## ##.##', [1], 'UNSUPPORTED_FORMAT');
    failure('## END\\', [1], 'UNSUPPORTED_FORMAT');
    failure('_#', [1], 'UNSUPPORTED_FORMAT');
  });

  it('rejects string values and identifies their one-based value index', () => {
    expect(failure('## ##', [1, '2'], 'TYPE_MISMATCH').diagnostic.message).toContain('value 2');
    failure('##', [''], 'TYPE_MISMATCH');
  });

  it.each([
    0.5,
    -0.5,
    12.345,
    -12.345,
    Number.MIN_VALUE,
    Number.MAX_SAFE_INTEGER + 1,
    -Number.MAX_SAFE_INTEGER - 1,
    Number.MAX_VALUE,
    NaN,
    Infinity,
    -Infinity,
  ])('rejects unsupported numeric value %s instead of rounding or reformatting it', (value) => {
    expect(
      failure('#################', [value], 'UNSUPPORTED_FORMAT_VALUE').diagnostic.message,
    ).toContain('value 1');
  });

  it('rejects insufficient sign/digit space without an invented overflow representation', () => {
    failure('##', [100], 'FORMAT_OVERFLOW');
    failure('##', [-12], 'FORMAT_OVERFLOW');
    failure('#', [-1], 'FORMAT_OVERFLOW');
    expect(failure('## ##', [1, 100], 'FORMAT_OVERFLOW').diagnostic.message).toContain('value 2');
    failure('###############', [Number.MAX_SAFE_INTEGER], 'FORMAT_OVERFLOW');
  });
});
