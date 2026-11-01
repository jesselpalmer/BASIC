import {BasicRuntimeError} from './diagnostic.ts';
import type {BasicValue, Location} from './types.ts';

const MAX_IMAGE_LENGTH = 4096;
export const maxPrintUsingValues = 4096;
const UNSUPPORTED_CHARACTERS = ".,+-*$^'_&%";

type ImagePart =
  | {readonly literal: string}
  | {
      readonly width: number;
      readonly kind: 'integer' | 'asterisk' | 'string';
      readonly trailingMinus?: boolean;
    };

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

/**
 * Native bounded subset: fixed-width integer/string fields and ASCII image literals.
 * No rounding, field overflow, image reuse, or literal escape is inferred from a
 * historical dialect. The caller owns expression evaluation and line termination.
 */
export function formatPrintUsing(
  image: BasicValue,
  values: readonly BasicValue[],
  location: Location,
): string {
  if (typeof image !== 'string') {
    fail('TYPE_MISMATCH', 'PRINT USING requires a string image', location);
  }
  if (image.length > MAX_IMAGE_LENGTH || values.length > maxPrintUsingValues) {
    fail('FORMAT_LIMIT', 'PRINT USING permits at most 4096 image characters and values', location);
  }

  const parts: ImagePart[] = [];
  let fieldCount = 0;
  for (let index = 0; index < image.length;) {
    const start = index;
    if (image[index] === '#' || image[index] === '*') {
      const asterisk = image[index] === '*';
      if (asterisk) {
        if (image[index + 1] !== '*' || image[index + 2] !== '#')
          fail(
            'UNSUPPORTED_FORMAT',
            'PRINT USING asterisk fields require ** followed by #',
            location,
          );
        index += 2;
      }
      while (image[index] === '#') index++;
      if (image[index] === '*')
        fail('UNSUPPORTED_FORMAT', 'PRINT USING asterisks must begin a numeric field', location);
      const trailingMinus = image[index] === '-';
      if (trailingMinus) index++;
      parts.push({width: index - start, kind: asterisk ? 'asterisk' : 'integer', trailingMinus});
      fieldCount++;
    } else if (image[index] === '!') {
      index++;
      parts.push({width: 1, kind: 'string'});
      fieldCount++;
    } else if (image[index] === '\\') {
      index++;
      while (image[index] === ' ') index++;
      if (image[index] !== '\\')
        fail(
          'UNSUPPORTED_FORMAT',
          'PRINT USING string fields require matching backslashes with only spaces between',
          location,
        );
      index++;
      parts.push({width: index - start, kind: 'string'});
      fieldCount++;
    } else {
      while (
        index < image.length &&
        image[index] !== '#' &&
        image[index] !== '*' &&
        image[index] !== '!' &&
        image[index] !== '\\'
      ) {
        const character = image[index];
        const code = image.charCodeAt(index);
        if (code < 32 || code > 126 || UNSUPPORTED_CHARACTERS.includes(character)) {
          fail(
            'UNSUPPORTED_FORMAT',
            `PRINT USING does not support image character ${JSON.stringify(character)}`,
            location,
          );
        }
        index++;
      }
      parts.push({literal: image.slice(start, index)});
    }
  }
  if (fieldCount === 0) {
    fail('UNSUPPORTED_FORMAT', 'PRINT USING requires at least one supported field', location);
  }
  if (values.length !== fieldCount) {
    fail(
      'FORMAT_VALUE_COUNT',
      `PRINT USING requires ${fieldCount} values; received ${values.length}`,
      location,
    );
  }

  const fields: string[] = [];
  let valueIndex = 0;
  for (const part of parts) {
    if ('width' in part) {
      const value = values[valueIndex];
      if (part.kind === 'string') {
        if (typeof value !== 'string')
          fail('TYPE_MISMATCH', `PRINT USING value ${valueIndex + 1} must be a string`, location);
        // Only emitted characters are inspected: total work is bounded by image width.
        const prefix = value.slice(0, part.width);
        for (let index = 0; index < prefix.length; index++)
          if (prefix.charCodeAt(index) > 255)
            fail(
              'UNSUPPORTED_FORMAT_VALUE',
              `PRINT USING value ${valueIndex + 1} requires byte characters in its field`,
              location,
            );
        fields.push(prefix);
      } else {
        if (typeof value !== 'number')
          fail('TYPE_MISMATCH', `PRINT USING value ${valueIndex + 1} must be numeric`, location);
        if (!Number.isSafeInteger(value))
          fail(
            'UNSUPPORTED_FORMAT_VALUE',
            `PRINT USING value ${valueIndex + 1} must be a safe integer`,
            location,
          );
        if (part.kind === 'asterisk' && value < 0 && !part.trailingMinus)
          fail(
            'UNSUPPORTED_FORMAT_VALUE',
            `PRINT USING value ${valueIndex + 1} requires a trailing sign for asterisk fill`,
            location,
          );
        const text = part.trailingMinus
          ? String(Math.abs(value)) + (value < 0 ? '-' : ' ')
          : String(value === 0 ? 0 : value);
        if (text.length > part.width) {
          fail(
            'FORMAT_OVERFLOW',
            `PRINT USING value ${valueIndex + 1} does not fit its field`,
            location,
          );
        }
        fields.push(text);
      }
      valueIndex++;
    }
  }

  // Every consumed field is valid before padding; the result is exactly image.length.
  valueIndex = 0;
  return parts
    .map((part) =>
      'literal' in part
        ? part.literal
        : part.kind === 'string'
          ? fields[valueIndex++].padEnd(part.width, ' ')
          : fields[valueIndex++].padStart(part.width, part.kind === 'asterisk' ? '*' : ' '),
    )
    .join('');
}
