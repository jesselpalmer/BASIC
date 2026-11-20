import {dataItems, DataReader} from './data.ts';
import {basicPlusMa2ReadNumeric} from './basic_plus_ma2_conversion.ts';
import {basicPlusStringLength} from './basic_plus_strings.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import type {SelectedMa2StringState} from './ma2_replay_strings.ts';
import type {createBasicPlusMa2ArraySession} from './evaluator.ts';
import type {NodeOf, ParsedLine} from './types.ts';

type NumericState = Pick<
  ReturnType<typeof createBasicPlusMa2ArraySession>,
  'validateNode' | 'assignWordsNode'
>;

/** A selected run shares the bounded DATA pool/cursor with the other dialects. */
type PreparedRead =
  | {kind: 'string'; literal: NodeOf<'StringLiteral'>}
  | {kind: 'numeric'; words: readonly [number, number]};

export class SelectedMa2Data {
  readonly #reader: DataReader;

  constructor(
    lines: readonly ParsedLine[],
    private readonly numeric: NumericState,
    private readonly strings: SelectedMa2StringState,
  ) {
    const items = dataItems(lines);
    for (const item of items) {
      const result = basicPlusStringLength(item.type === 'StringLiteral' ? item.value : item.raw);
      if (result.kind !== 'value')
        throw new BasicSyntaxError(
          'UNSUPPORTED_MA2_DATA',
          `Selected MA2 DATA: ${result.reason}`,
          item.location.start,
          item.location.label,
        );
    }
    this.#reader = new DataReader(items);
  }

  validateRead(statement: NodeOf<'ReadStatement'>): void {
    for (const target of statement.targets) {
      if (target.name.endsWith('$')) this.strings.validateOperand(target);
      else {
        if (!/^[A-Z][0-9]?$/.test(target.name))
          throw new BasicSyntaxError(
            'UNSUPPORTED_MA2_DATA',
            'Selected numeric READ requires a short floating target',
            target.location.start,
            target.location.label,
          );
        this.numeric.validateNode(target);
      }
    }
  }

  restore(): void {
    this.#reader.restore();
  }

  read(statement: NodeOf<'ReadStatement'>): void {
    this.#reader.readPrepared<PreparedRead>(
      statement,
      (target, item) => {
        const text = item.type === 'StringLiteral' ? item.value : item.raw.replaceAll(' ', '');
        if (target.name.endsWith('$'))
          return {
            kind: 'string',
            literal: {type: 'StringLiteral', value: text, raw: item.raw, location: item.location},
          };
        const quoted = item.type === 'StringLiteral' && /^[ \t]*["']/.test(item.raw);
        const converted = basicPlusMa2ReadNumeric(text, 'floating', quoted);
        if (converted.kind !== 'value')
          throw new BasicRuntimeError(
            converted.kind === 'error' ? 'MA2_READ_ERROR' : 'UNSUPPORTED_MA2_DATA',
            `Selected MA2 READ: ${converted.kind === 'error' ? converted.code : converted.reason}`,
            target.location.start,
            target.location.label,
          );
        return {kind: 'numeric', words: converted.words};
      },
      (target, value) => {
        if (value.kind === 'string') {
          this.strings.assignSource({
            type: 'LetStatement',
            target,
            expression: value.literal,
            location: statement.location,
          });
          return;
        }
        const result = this.numeric.assignWordsNode(target, value.words);
        if (result.kind !== 'value')
          throw new BasicRuntimeError(
            result.kind === 'numeric-event' ? 'MA2_NUMERIC_EVENT' : 'UNSUPPORTED_MA2_VALUE',
            `Selected MA2 READ: ${result.kind === 'numeric-event' ? result.code : result.reason}`,
            target.location.start,
            target.location.label,
          );
      },
    );
  }
}
