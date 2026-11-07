import type {Dialect} from './types.ts';

/** Missing metadata is legacy native source, never the caller's selected profile. */
export function validateDialect(value: unknown, expected?: Dialect): Dialect {
  const declared = value === undefined ? 'native' : value;
  if (
    (declared !== 'native' && declared !== 'basic-plus-v4a12-ma2') ||
    (expected !== undefined && declared !== expected)
  ) {
    throw new TypeError(
      `Unsupported or conflicting BASIC dialect; expected "${expected ?? 'native or basic-plus-v4a12-ma2'}"`,
    );
  }
  return declared;
}
