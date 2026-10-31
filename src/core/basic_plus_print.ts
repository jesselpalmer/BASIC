/** Internal October 1972 layout for a 72-column, five-zone terminal. */
export const BASIC_PLUS_PRINT_OPERATION_LIMIT = 4096;
export const BASIC_PLUS_PRINT_OUTPUT_LIMIT = 65536;

export type BasicPlusPrintOperation =
  | Readonly<{kind: 'text'; value: string}>
  | Readonly<{kind: 'integer'; value: number}>
  | Readonly<{kind: 'comma'}>
  | Readonly<{kind: 'semicolon'}>;

export type BasicPlusPrintResult =
  | Readonly<{kind: 'value'; text: string; column: number}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'operation-limit' | 'output-limit' | 'integer-domain' | 'text-domain' | 'line-width';
    }>;

type UnsupportedReason = Extract<BasicPlusPrintResult, {kind: 'unsupported'}>['reason'];

function unsupported(reason: UnsupportedReason): BasicPlusPrintResult {
  return Object.freeze({kind: 'unsupported', reason});
}

function requireOperationList(operations: unknown): void {
  if (!Array.isArray(operations)) throw new TypeError('Expected BASIC-PLUS PRINT operations');
}

/** Decoded layout only: no expression evaluation, parser, host or retained state. */
export function basicPlusPrintLayout(
  operations: readonly BasicPlusPrintOperation[],
  column = 0,
): BasicPlusPrintResult {
  requireOperationList(operations);
  if (!Number.isInteger(column) || column < 0 || column > 72)
    throw new RangeError('Expected a PRINT cursor in columns 0..72');
  const operationCount = operations.length;
  if (operationCount > BASIC_PLUS_PRINT_OPERATION_LIMIT) return unsupported('operation-limit');
  const chunks: string[] = [];
  let outputLength = 0;
  let suppressNewline = false;
  const append = (text: string): boolean => {
    if (outputLength + text.length > BASIC_PLUS_PRINT_OUTPUT_LIMIT) return false;
    chunks.push(text);
    outputLength += text.length;
    return true;
  };

  // Numeric traversal binds work to the checked count, not a caller's iterator.
  for (let operationIndex = 0; operationIndex < operationCount; operationIndex++) {
    const operation = operations[operationIndex];
    if (operation === null || typeof operation !== 'object')
      throw new TypeError('Expected a BASIC-PLUS PRINT operation');
    let text: string;
    switch (operation.kind) {
      case 'comma': {
        const next = (Math.floor(column / 14) + 1) * 14;
        if (!append(next > 56 ? '\n' : ' '.repeat(next - column)))
          return unsupported('output-limit');
        column = next > 56 ? 0 : next;
        suppressNewline = true;
        continue;
      }
      case 'semicolon':
        suppressNewline = true;
        continue;
      case 'text': {
        const input = operation.value;
        if (typeof input !== 'string') throw new TypeError('Expected PRINT text');
        text = input;
        if (text.length > 72 - column) return unsupported('line-width');
        for (let index = 0; index < text.length; index++) {
          const code = text.charCodeAt(index);
          if (code < 32 || code > 126) return unsupported('text-domain');
        }
        break;
      }
      case 'integer': {
        const input = operation.value;
        if (typeof input !== 'number') throw new TypeError('Expected a PRINT integer');
        if (!Number.isInteger(input) || input < -32768 || input > 32767)
          return unsupported('integer-domain');
        text = (input < 0 ? '' : ' ') + String(input) + ' ';
        break;
      }
      default:
        throw new TypeError('Unknown BASIC-PLUS PRINT operation');
    }
    if (text.length > 72 - column) return unsupported('line-width');
    if (!append(text)) return unsupported('output-limit');
    column += text.length;
    suppressNewline = false;
  }
  if (!suppressNewline) {
    if (!append('\n')) return unsupported('output-limit');
    column = 0;
  }
  return Object.freeze({kind: 'value', text: chunks.join(''), column});
}
