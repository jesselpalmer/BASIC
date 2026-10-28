interface NativeIntrinsic {
  readonly name: 'ABS' | 'INT' | 'RND' | 'INKEY$' | 'KEYDOWN';
  readonly arity: 0 | 1;
  readonly resultType: 'number' | 'string';
}

const abs = Object.freeze({name: 'ABS', arity: 1, resultType: 'number'} as const);
const int = Object.freeze({name: 'INT', arity: 1, resultType: 'number'} as const);
const rnd = Object.freeze({name: 'RND', arity: 0, resultType: 'number'} as const);
const inkey = Object.freeze({name: 'INKEY$', arity: 0, resultType: 'string'} as const);
const keydown = Object.freeze({name: 'KEYDOWN', arity: 1, resultType: 'number'} as const);

// Canonical native identities only: no case folding, aliases or array fallback.
// These signatures describe calls; implementations remain in the evaluator.
export function nativeIntrinsic(name: string): NativeIntrinsic | null {
  switch (name) {
    case 'ABS':
      return abs;
    case 'INT':
      return int;
    case 'RND':
      return rnd;
    case 'INKEY$':
      return inkey;
    case 'KEYDOWN':
      return keydown;
    default:
      return null;
  }
}
