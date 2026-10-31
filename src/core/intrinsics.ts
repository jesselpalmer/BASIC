interface NativeIntrinsic {
  readonly name: 'ABS' | 'INT' | 'RND' | 'INKEY$' | 'KEYDOWN';
  readonly arity: 0 | 1;
  readonly resultType: 'number' | 'string';
}

type HistoricalNumericIntrinsicName =
  | 'ABS'
  | 'SGN'
  | 'INT'
  | 'FIX'
  | 'COS'
  | 'SIN'
  | 'TAN'
  | 'ATN'
  | 'SQR'
  | 'EXP'
  | 'LOG10'
  | 'LOG'
  | 'PI'
  | 'RND';

interface HistoricalIntrinsicForm {
  readonly syntax: 'bare' | 'parenthesized';
  readonly arity: 0 | 1;
}

interface HistoricalNumericIntrinsic {
  readonly name: HistoricalNumericIntrinsicName;
  readonly forms: readonly HistoricalIntrinsicForm[];
  readonly resultType: 'number';
  /** Inventory only: historical evaluation is not enabled by this signature. */
  readonly executable: false;
}

const abs = Object.freeze({name: 'ABS', arity: 1, resultType: 'number'} as const);
const int = Object.freeze({name: 'INT', arity: 1, resultType: 'number'} as const);
const rnd = Object.freeze({name: 'RND', arity: 0, resultType: 'number'} as const);
const inkey = Object.freeze({name: 'INKEY$', arity: 0, resultType: 'string'} as const);
const keydown = Object.freeze({name: 'KEYDOWN', arity: 1, resultType: 'number'} as const);

const unaryForm = Object.freeze({syntax: 'parenthesized', arity: 1} as const);
const bareForm = Object.freeze({syntax: 'bare', arity: 0} as const);
const unaryForms = Object.freeze([unaryForm]);
const bareForms = Object.freeze([bareForm]);
const randomForms = Object.freeze([bareForm, unaryForm]);

function historicalSignature(
  name: HistoricalNumericIntrinsicName,
  forms: readonly HistoricalIntrinsicForm[],
): HistoricalNumericIntrinsic {
  return Object.freeze({name, forms, resultType: 'number', executable: false});
}

const historicalAbs = historicalSignature('ABS', unaryForms);
const historicalSgn = historicalSignature('SGN', unaryForms);
const historicalInt = historicalSignature('INT', unaryForms);
const historicalFix = historicalSignature('FIX', unaryForms);
const historicalCos = historicalSignature('COS', unaryForms);
const historicalSin = historicalSignature('SIN', unaryForms);
const historicalTan = historicalSignature('TAN', unaryForms);
const historicalAtn = historicalSignature('ATN', unaryForms);
const historicalSqr = historicalSignature('SQR', unaryForms);
const historicalExp = historicalSignature('EXP', unaryForms);
const historicalLog10 = historicalSignature('LOG10', unaryForms);
const historicalLog = historicalSignature('LOG', unaryForms);
const historicalPi = historicalSignature('PI', bareForms);
const historicalRnd = historicalSignature('RND', randomForms);

// Scanner matching is prefix-sensitive. Keep longer identities such as LOG10
// before their prefixes, and keep this closed inventory independent of native
// reserved words and public dialect selection.
export const historicalNumericIntrinsicNames: readonly HistoricalNumericIntrinsicName[] =
  Object.freeze([
    'ABS',
    'SGN',
    'INT',
    'FIX',
    'COS',
    'SIN',
    'TAN',
    'ATN',
    'SQR',
    'EXP',
    'LOG10',
    'LOG',
    'PI',
    'RND',
  ]);

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

/**
 * Internal October 1972 BASIC-PLUS inventory. Recognition does not authorize
 * parsing or evaluation; every returned signature is deliberately marked
 * non-executable until profile, numeric, error and RNG policies are activated.
 */
export function historicalNumericIntrinsic(name: string): HistoricalNumericIntrinsic | null {
  switch (name) {
    case 'ABS':
      return historicalAbs;
    case 'SGN':
      return historicalSgn;
    case 'INT':
      return historicalInt;
    case 'FIX':
      return historicalFix;
    case 'COS':
      return historicalCos;
    case 'SIN':
      return historicalSin;
    case 'TAN':
      return historicalTan;
    case 'ATN':
      return historicalAtn;
    case 'SQR':
      return historicalSqr;
    case 'EXP':
      return historicalExp;
    case 'LOG10':
      return historicalLog10;
    case 'LOG':
      return historicalLog;
    case 'PI':
      return historicalPi;
    case 'RND':
      return historicalRnd;
    default:
      return null;
  }
}
