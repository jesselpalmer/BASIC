import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {lineStatements} from './instructions.ts';
import {signedNumericLiteral} from './numeric_literal.ts';
import type {Evaluator} from './evaluator.ts';
import type {Location, NodeOf, ParsedLine} from './types.ts';

export const maxDataListItems = 4096;
const maxProgramDataItems = 262_144;
type DataItem = NodeOf<'NumberLiteral'> | NodeOf<'StringLiteral'>;

function fail(code: string, message: string, location: Location): never {
  throw new BasicSyntaxError(code, message, location.start, location.label);
}

/** Validate even unreachable lists before building a bounded immutable pool. */
export function dataItems(lines: readonly ParsedLine[]): readonly DataItem[] {
  const items: DataItem[] = [];
  for (const line of lines) {
    const statements = lineStatements(line);
    for (const [ordinal, statement] of statements.entries()) {
      if (statement.type !== 'DataStatement' && statement.type !== 'ReadStatement') continue;
      const list = statement.type === 'DataStatement' ? statement.items : statement.targets;
      if (!Array.isArray(list) || list.length === 0)
        fail('INVALID_DATA', 'DATA and READ require a nonempty list', statement.location);
      if (list.length > maxDataListItems)
        fail(
          'DATA_LIMIT',
          `DATA/READ permit at most ${maxDataListItems} items`,
          statement.location,
        );
      if (statement.type === 'ReadStatement') {
        for (const target of statement.targets) {
          if (!target || (target.type !== 'Variable' && target.type !== 'ArrayReference'))
            fail('INVALID_DATA', 'READ requires variable or array targets', statement.location);
        }
        continue;
      }
      if (ordinal !== statements.length - 1)
        fail('INVALID_DATA', 'DATA must be the last statement on its line', statement.location);
      if (items.length + statement.items.length > maxProgramDataItems)
        fail(
          'DATA_LIMIT',
          `A program permits at most ${maxProgramDataItems} DATA items`,
          statement.location,
        );
      for (const item of statement.items) {
        const numericSpelling =
          item?.type === 'NumberLiteral' && typeof item.raw === 'string'
            ? item.raw.replace(/^([+-])[ \t]+/, '$1')
            : '';
        if (
          !item ||
          (item.type !== 'StringLiteral' && item.type !== 'NumberLiteral') ||
          (item.type === 'StringLiteral' && typeof item.value !== 'string') ||
          (item.type === 'NumberLiteral' &&
            (!Number.isFinite(item.value) ||
              !signedNumericLiteral.test(numericSpelling) ||
              Number(numericSpelling) !== item.value))
        )
          fail(
            'INVALID_DATA',
            'DATA requires finite numeric or quoted string literals',
            statement.location,
          );
        items.push(item);
      }
    }
  }
  return Object.freeze(items);
}

/** One run owns its cursor; neither branches nor subroutine frames own data. */
export class DataReader {
  #index = 0;
  constructor(readonly items: readonly DataItem[]) {}

  restore(): void {
    this.#index = 0;
  }

  read(statement: NodeOf<'ReadStatement'>, evaluator: Evaluator): void {
    for (const target of statement.targets) {
      const item = this.items[this.#index];
      if (!item)
        throw new BasicRuntimeError(
          'OUT_OF_DATA',
          'READ has exhausted the DATA pool',
          target.location.start,
          target.location.label,
        );
      evaluator.assign(target, item.value);
      this.#index++;
    }
  }
}
