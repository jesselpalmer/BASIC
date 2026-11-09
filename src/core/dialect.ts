import type {Dialect} from './types.ts';

/** Missing metadata is legacy native source, never the caller's selected profile. */
export function validateDialect(value: unknown, expected?: Dialect): Dialect {
  const declared = value === undefined ? 'native' : value;
  if (
    (declared !== 'native' &&
      declared !== 'basic-plus-v4a12-ma2' &&
      declared !== 'edusystem-30' &&
      declared !== 'altair-8k-4.0') ||
    (expected !== undefined && declared !== expected)
  ) {
    throw new TypeError(
      `Unsupported or conflicting BASIC dialect; expected "${expected ?? 'native, basic-plus-v4a12-ma2, edusystem-30 or altair-8k-4.0'}"`,
    );
  }
  return declared;
}
