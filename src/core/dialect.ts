import type {Dialect} from './types.ts';

/** Missing metadata is legacy native source, never the caller's selected profile. */
export function validateDialect(value: unknown, expected: Dialect = 'native'): Dialect {
  const declared = value === undefined ? 'native' : value;
  if (declared !== expected) {
    throw new TypeError(`Unsupported or conflicting BASIC dialect; expected "${expected}"`);
  }
  return expected;
}
