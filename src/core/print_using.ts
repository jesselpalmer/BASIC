import {BasicRuntimeError} from './diagnostic.ts';
import type {BasicValue, Location} from './types.ts';

const MAX_IMAGE_LENGTH = 4096;
export const maxPrintUsingValues = 4096;
const UNSUPPORTED_CHARACTERS = ".,+-*$^!\\'_&%";

type ImagePart = {readonly literal: string} | {readonly width: number};

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

/**
 * Native bounded subset: one pass of integer # fields and printable ASCII literals.
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
    if (image[index] === '#') {
      while (image[index] === '#') index++;
      parts.push({width: index - start});
      fieldCount++;
    } else {
      while (index < image.length && image[index] !== '#') {
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
    fail('UNSUPPORTED_FORMAT', 'PRINT USING requires at least one integer # field', location);
  }
  if (values.length !== fieldCount) {
    fail(
      'FORMAT_VALUE_COUNT',
      `PRINT USING requires ${fieldCount} values; received ${values.length}`,
      location,
    );
  }

  const numbers = values.map((value, index) => {
    if (typeof value !== 'number') {
      fail('TYPE_MISMATCH', `PRINT USING value ${index + 1} must be numeric`, location);
    }
    if (!Number.isSafeInteger(value)) {
      fail(
        'UNSUPPORTED_FORMAT_VALUE',
        `PRINT USING value ${index + 1} must be a safe integer`,
        location,
      );
    }
    return String(value === 0 ? 0 : value);
  });

  let valueIndex = 0;
  for (const part of parts) {
    if ('width' in part) {
      if (numbers[valueIndex].length > part.width) {
        fail(
          'FORMAT_OVERFLOW',
          `PRINT USING value ${valueIndex + 1} does not fit its field`,
          location,
        );
      }
      valueIndex++;
    }
  }

  // Every field fits before padding begins; the result is exactly image.length.
  valueIndex = 0;
  return parts
    .map((part) =>
      'literal' in part ? part.literal : numbers[valueIndex++].padStart(part.width, ' '),
    )
    .join('');
}
