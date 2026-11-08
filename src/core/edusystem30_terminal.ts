import type {BasicValue} from './types.ts';

/** Sign and trailing padding observed in the EDUSYSTEM-30 numeric field. */
export function formatEduSystem30PrintValue(value: BasicValue): string {
  if (typeof value === 'string') return value;
  return `${value < 0 ? '' : ' '}${value} `;
}

export const eduSystem30InputPresentation = Object.freeze({
  prompt: '?',
  invalidNumber: 'BAD DATA-RETYPE FROM ERROR.\n',
});
