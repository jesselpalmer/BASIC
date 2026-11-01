import {BasicSyntaxError} from './diagnostic.ts';
import type {NodeOf} from './types.ts';

export const maxChangeLength = 32767;

/** One syntax boundary for parsed and caller-supplied CHANGE statements. */
export function changeOperands(statement: NodeOf<'ChangeStatement'>): {
  array: NodeOf<'Variable'>;
  string: NodeOf<'Variable'>;
  toArray: boolean;
} {
  for (const operand of [statement.source, statement.target]) {
    if (
      operand?.type !== 'Variable' ||
      typeof operand.name !== 'string' ||
      !/^[A-Z][A-Z0-9]*\$?$/i.test(operand.name)
    )
      throw new BasicSyntaxError(
        'INVALID_CHANGE',
        'CHANGE requires two bare names',
        statement.location.start,
        statement.location.label,
      );
  }
  const toArray = statement.source.name.endsWith('$');
  if (toArray === statement.target.name.endsWith('$'))
    throw new BasicSyntaxError(
      'INVALID_CHANGE',
      'CHANGE requires one string scalar and one numeric array',
      statement.location.start,
      statement.location.label,
    );
  return {
    array: toArray ? statement.target : statement.source,
    string: toArray ? statement.source : statement.target,
    toArray,
  };
}
