import {BasicSyntaxError} from './diagnostic.ts';
import type {Location} from './types.ts';
import {validateBasicPlusMa2Candidate} from '../parser/ma2_candidate_validation.ts';

const MAX_SELECTED_IMAGE_LENGTH = 72;
const IMAGE_LITERAL = /^[ A-Za-z0-9:;=/|()?]*$/;

type SelectedImagePart = Readonly<{literal: string} | {width: number}>;

/** A bounded numeric image subset of BASIC-PLUS Oct 1972 §10.4.1. */
function selectedImageParts(image: string): readonly SelectedImagePart[] | null {
  if (image.length > MAX_SELECTED_IMAGE_LENGTH) return null;
  const parts: SelectedImagePart[] = [];
  for (let index = 0; index < image.length;) {
    const start = index;
    if (image[index] === '#') {
      while (image[index] === '#') index++;
      const width = index - start;
      // MA2's two-word package supplies at most six significant digits.
      if (width > 6) return null;
      parts.push({width});
    } else {
      while (index < image.length && image[index] !== '#') index++;
      const literal = image.slice(start, index);
      if (!IMAGE_LITERAL.test(literal)) return null;
      parts.push({literal});
    }
  }
  return parts.some((part) => 'width' in part) ? parts : null;
}

export function selectedMa2ImageFieldCount(image: string): number | null {
  const parts = selectedImageParts(image);
  return parts ? parts.filter((part) => 'width' in part).length : null;
}

/** Selected integer fields only; historical fractional masks remain gated. */
export function formatSelectedMa2Using(
  image: string,
  values: readonly number[],
): {kind: 'value'; text: string} | {kind: 'unsupported'; reason: 'image' | 'integer-domain'} {
  const parts = selectedImageParts(image);
  if (!parts || parts.filter((part) => 'width' in part).length !== values.length)
    return {kind: 'unsupported', reason: 'image'};
  const chunks: string[] = [];
  let valueIndex = 0;
  for (const part of parts) {
    if ('literal' in part) {
      chunks.push(part.literal);
      continue;
    }
    const value = values[valueIndex++];
    if (!Number.isInteger(value) || value < -32768 || value > 32767)
      return {kind: 'unsupported', reason: 'integer-domain'};
    const digits = String(value);
    // §10.4.1 prints a percent marker followed by the complete value when
    // a numeric field is too narrow; a positive number keeps its sign space.
    chunks.push(
      digits.length <= part.width
        ? digits.padStart(part.width, ' ')
        : `%${value < 0 ? '' : ' '}${digits}`,
    );
  }
  return {kind: 'value', text: chunks.join('')};
}

export interface CandidateImage {
  readonly variable: string;
  readonly image: string;
  readonly fieldCount: number;
  readonly location: Location;
}

/** Conservative static image facts; no statement execution or output oracle. */
export function selectedMa2CandidateImages(source: string): readonly CandidateImage[] {
  const candidate = validateBasicPlusMa2Candidate(source);
  const writes = new Map<string, {value: string | null; index: number}[]>();
  for (const [index, {statement}] of candidate.instructions.entries()) {
    const targets =
      statement.type === 'LetStatement'
        ? [statement.target]
        : statement.type === 'InputStatement' || statement.type === 'InputLineStatement'
          ? [statement.target]
          : statement.type === 'InputTargetsStatement'
            ? statement.targets
            : [];
    for (const target of targets) {
      if (target.type !== 'Variable' || !target.name.endsWith('$')) continue;
      const entries = writes.get(target.name) ?? [];
      entries.push({
        value:
          statement.type === 'LetStatement' && statement.expression.type === 'StringLiteral'
            ? statement.expression.value
            : null,
        index,
      });
      writes.set(target.name, entries);
    }
  }
  const result: CandidateImage[] = [];
  for (const [index, {statement}] of candidate.instructions.entries()) {
    if (statement.type !== 'PrintUsingStatement') continue;
    const fail = (message: string): BasicSyntaxError => {
      return new BasicSyntaxError(
        'UNSUPPORTED_MA2_IMAGE',
        message,
        statement.format.location.start,
        statement.location.label,
      );
    };
    const format = statement.format;
    if (format.type !== 'Variable' || !format.name.endsWith('$'))
      throw fail('Selected MA2 image requires a bound string variable');
    const definitions = writes.get(format.name) ?? [];
    if (definitions.length !== 1 || definitions[0].index >= index)
      throw fail('Selected MA2 image requires one earlier literal assignment and no other writes');
    const image = definitions[0].value;
    if (image === null)
      throw fail('Selected MA2 image requires one earlier literal assignment and no other writes');
    const parts = selectedImageParts(image);
    if (!parts) throw fail('Unsupported selected MA2 image field');
    const fieldCount = parts.filter((part) => 'width' in part).length;
    if (fieldCount !== statement.items.length) throw fail('Selected MA2 image/value count differs');
    result.push(
      Object.freeze({
        variable: format.name,
        image,
        fieldCount,
        location: statement.location,
      }),
    );
  }
  return Object.freeze(result);
}
