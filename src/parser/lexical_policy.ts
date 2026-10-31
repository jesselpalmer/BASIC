import {historicalNumericIntrinsicNames} from '../core/intrinsics.ts';

// Internal scanner conformance is deliberately separate from public Dialect.
// A token stream alone cannot supply a historical program's runtime semantics.
export type LexicalPolicy = 'native' | 'basic-plus-1972-10';

interface ScannerPolicy {
  readonly compact: boolean;
  readonly maximumLabel: number;
}

const native = Object.freeze({compact: false, maximumLabel: 65535});
const basicPlus = Object.freeze({compact: true, maximumLabel: 32767});

export function scannerPolicy(policy: LexicalPolicy = 'native'): ScannerPolicy {
  switch (policy) {
    case 'native':
      return native;
    case 'basic-plus-1972-10':
      return basicPlus;
    default:
      throw new TypeError(`Unsupported internal lexical policy ${JSON.stringify(policy)}`);
  }
}

interface HistoricalWord {
  readonly word: string;
  readonly role: 'statement' | 'function' | 'delimiter' | 'unsupported';
}

// Appendix A.4 identifies unsupported statement words too: recognizing STOP
// must fail before a fallback could split it into the short name S, TO and P.
const words: readonly HistoricalWord[] = Object.freeze([
  ...[
    'LET',
    'PRINT',
    'INPUT',
    'IF',
    'GOTO',
    'GOSUB',
    'RETURN',
    'ON',
    'FOR',
    'NEXT',
    'DIM',
    'DATA',
    'READ',
    'RESTORE',
    'END',
    'REM',
  ].map((word) => Object.freeze({word, role: 'statement' as const})),
  ...['THEN', 'ELSE', 'TO', 'STEP'].map((word) =>
    Object.freeze({word, role: 'delimiter' as const}),
  ),
  ...historicalNumericIntrinsicNames.map((word) =>
    Object.freeze({word, role: 'function' as const}),
  ),
  ...[
    'IMAGE',
    'STOP',
    'CHANGE',
    'MAT',
    'DEF',
    'FNEND',
    'RANDOMIZE',
    'RANDOM',
    'OPEN',
    'CLOSE',
    'NAME',
    'KILL',
    'RESUME',
    'CHAIN',
    'UNLESS',
    'WHILE',
    'UNTIL',
    'SLEEP',
    'WAIT',
    'LSET',
    'RSET',
    'FIELD',
    'GET',
    'PUT',
    'UNLOCK',
    'LINE',
    'USING',
    'ERROR',
  ].map((word) => Object.freeze({word, role: 'unsupported' as const})),
]);

export function historicalWord(source: string, index: number): HistoricalWord | undefined {
  return words.find(({word, role}) => {
    if (!source.startsWith(word, index)) return false;
    // Intrinsic matching is maximal. A reviewed identity cannot be a prefix of
    // an unsupported longer spelling such as LOG100, SQRT or SINH.
    const following = source[index + word.length];
    return role !== 'function' || following === undefined || !/[A-Za-z0-9$%]/.test(following);
  });
}
