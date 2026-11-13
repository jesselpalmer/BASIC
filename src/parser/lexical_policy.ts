import {historicalNumericIntrinsicNames} from '../core/intrinsics.ts';

// Internal scanner conformance is deliberately separate from public Dialect.
// A token stream alone cannot supply a historical program's runtime semantics.
export type LexicalPolicy = 'native' | 'basic-plus-1972-10' | 'altair-8k-4.0' | 'edusystem-30';

interface ScannerPolicy {
  readonly compact: boolean;
  readonly maximumLabel: number;
  readonly ma2: boolean;
  readonly eduSystem30?: true;
  readonly word: typeof historicalWord;
}

const native = Object.freeze({
  compact: false,
  maximumLabel: 65535,
  ma2: false,
  word: historicalWord,
});
const basicPlus = Object.freeze({
  compact: true,
  maximumLabel: 32767,
  ma2: true,
  word: historicalWord,
});
const altair = Object.freeze({compact: true, maximumLabel: 65535, ma2: false, word: altairWord});
const eduSystem30 = Object.freeze({...native, eduSystem30: true as const});

export function scannerPolicy(policy: LexicalPolicy = 'native'): ScannerPolicy {
  switch (policy) {
    case 'native':
      return native;
    case 'basic-plus-1972-10':
      return basicPlus;
    case 'altair-8k-4.0':
      return altair;
    case 'edusystem-30':
      return eduSystem30;
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
    'SLEEP',
    'END',
    'REM',
  ].map((word) => Object.freeze({word, role: 'statement' as const})),
  ...['THEN', 'ELSE', 'TO', 'STEP'].map((word) =>
    Object.freeze({word, role: 'delimiter' as const}),
  ),
  ...historicalNumericIntrinsicNames.map((word) =>
    Object.freeze({word, role: 'function' as const}),
  ),
  Object.freeze({word: 'TAB', role: 'function' as const}),
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

function historicalWord(source: string, index: number): HistoricalWord | undefined {
  return words.find(({word, role}) => {
    if (!source.startsWith(word, index)) return false;
    // Intrinsic matching is maximal. A reviewed identity cannot be a prefix of
    // an unsupported longer spelling such as LOG100, SQRT or SINH.
    const following = source[index + word.length];
    return role !== 'function' || following === undefined || !/[A-Za-z0-9$%]/.test(following);
  });
}

const altairExtraWords: readonly HistoricalWord[] = [
  {word: 'CHR$', role: 'function'},
  {word: 'RUN', role: 'statement'},
];

function altairWord(source: string, index: number): HistoricalWord | undefined {
  return (
    altairExtraWords.find(({word}) => source.startsWith(word, index)) ??
    historicalWord(source, index)
  );
}
