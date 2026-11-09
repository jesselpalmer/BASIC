import type {Evaluator} from './evaluator.ts';
import type {Expression} from './types.ts';

/** Sign and trailing padding observed in the EDUSYSTEM-30 numeric field. */
export function formatEduSystem30PrintItem(item: Expression, evaluator: Evaluator): string {
  // Source admission permits only the literal CHR$(7) terminal control.
  if (item.type === 'CallExpression' && item.name === 'CHR$') return '\x07';
  const value = evaluator.evaluate(item);
  if (typeof value === 'string') return value;
  return `${value < 0 ? '' : ' '}${value} `;
}

export const eduSystem30InputPresentation = Object.freeze({
  prompt: '?',
  invalidNumber: 'BAD DATA-RETYPE FROM ERROR.\n',
});
