import {BasicSyntaxError} from './diagnostic.ts';
import {formatPrintUsing} from './print_using.ts';
import type {Location} from './types.ts';
import {validateBasicPlusMa2Candidate} from '../parser/ma2_candidate_validation.ts';

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
    // The reviewed first-game subset consists of repeated two-column integer
    // fields separated by printable spaces. Other image grammars remain gated.
    if (!/^##(?: +##)*$/.test(image)) throw fail('Unsupported selected MA2 image field');
    const fieldCount = image.match(/##/g)!.length;
    if (fieldCount !== statement.items.length) throw fail('Selected MA2 image/value count differs');
    formatPrintUsing(image, Array(fieldCount).fill(0), statement.location);
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
