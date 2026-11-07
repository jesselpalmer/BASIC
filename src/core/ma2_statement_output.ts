import {
  basicPlusPrintLayout,
  type BasicPlusPrintOperation,
  type BasicPlusPrintResult,
} from './basic_plus_print.ts';
import {observeMa2Value, type Ma2Value} from './ma2_value.ts';
import {formatSelectedMa2Using, selectedMa2ImageFieldCount} from './ma2_using_image.ts';
import type {Expression, NodeOf} from './types.ts';

type Printable = string | Ma2Value;
type Statement = NodeOf<'PrintStatement'> | NodeOf<'PrintUsingStatement'>;
export type Ma2OutputResult =
  | Readonly<{kind: 'value'; text: string; column: number}>
  | Readonly<{
      kind: 'unsupported';
      reason:
        | 'numeric-observation'
        | 'image'
        | Extract<BasicPlusPrintResult, {kind: 'unsupported'}>['reason'];
    }>;

/** Execution-owned cursor and atomic output for the selected first-game PRINT subset. */
export class Ma2StatementOutput {
  #column = 0;
  constructor(private readonly write: (text: string) => void) {}

  get column(): number {
    return this.#column;
  }

  reset(): void {
    this.#column = 0;
  }

  execute(statement: Statement, resolve: (expression: Expression) => Printable): Ma2OutputResult {
    const operations: BasicPlusPrintOperation[] = [];
    if (statement.type === 'PrintUsingStatement') {
      const image = resolve(statement.format);
      if (typeof image !== 'string' || selectedMa2ImageFieldCount(image) !== statement.items.length)
        return Object.freeze({kind: 'unsupported', reason: 'image'});
      const values: number[] = [];
      for (const item of statement.items) {
        const value = resolve(item);
        if (typeof value === 'string')
          return Object.freeze({kind: 'unsupported', reason: 'integer-domain'});
        const observed = observeMa2Value(value);
        if (observed.kind !== 'value')
          return Object.freeze({kind: 'unsupported', reason: 'numeric-observation'});
        values.push(observed.value);
      }
      const formatted = formatSelectedMa2Using(image, values);
      if (formatted.kind !== 'value') return formatted;
      operations.push({kind: 'text', value: formatted.text});
    } else {
      for (const [index, item] of statement.items.entries()) {
        if (item.type === 'CallExpression' && item.name === 'TAB') {
          const position = resolve(item.arguments[0]);
          if (typeof position === 'string')
            return Object.freeze({kind: 'unsupported', reason: 'tab-domain'});
          const observed = observeMa2Value(position);
          if (observed.kind !== 'value')
            return Object.freeze({kind: 'unsupported', reason: 'numeric-observation'});
          operations.push({kind: 'tab', value: observed.value});
        } else {
          const value = resolve(item);
          if (typeof value === 'string') operations.push({kind: 'text', value});
          else {
            const observed = observeMa2Value(value);
            if (observed.kind !== 'value')
              return Object.freeze({kind: 'unsupported', reason: 'numeric-observation'});
            operations.push({kind: 'integer', value: observed.value});
          }
        }
        const separator = statement.candidateSeparators?.[index];
        if (separator) operations.push({kind: separator});
        for (let skip = 0; skip < (statement.candidateCommaSkips?.[index] ?? 0); skip++)
          operations.push({kind: 'comma'});
      }
    }
    if (
      statement.trailingSemicolon &&
      (statement.type === 'PrintUsingStatement' || statement.candidateSeparators === undefined)
    )
      operations.push({kind: 'semicolon'});
    const result = basicPlusPrintLayout(operations, this.#column);
    if (result.kind !== 'value') return result;
    this.write(result.text);
    this.#column = result.column;
    return result;
  }
}
