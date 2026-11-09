import {BasicRuntimeError} from './diagnostic.ts';
import {
  inputTargets,
  maxInputResponseLength,
  readInputResponse,
  type InputStatement,
} from './input.ts';
import type {Evaluator} from './evaluator.ts';
import type {AssignmentTarget, Host, Location, NodeOf} from './types.ts';

const width = 80;
const numericPrefix = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/;

function printPosition(value: number, maximum: number, location: Location): number {
  if (value < 0 || Math.trunc(value) > maximum)
    throw new BasicRuntimeError(
      'ALTAIR_FC',
      'Invalid PRINT control argument',
      location.start,
      location.label,
    );
  return Math.trunc(value);
}

/** Terminal state survives an in-program RUN and resets on a new host run. */
export class AltairTerminal {
  #column = 0;

  reset(): void {
    this.#column = 0;
  }

  print(
    statement: NodeOf<'PrintStatement'>,
    evaluator: Evaluator,
    write: (text: string) => void,
  ): void {
    let text = '';
    const append = (part: string) => {
      for (const character of part) {
        if (character === '\r' || character === '\n') {
          this.#column = 0;
        } else {
          if (this.#column === width) {
            text += '\n';
            this.#column = 0;
          }
          this.#column++;
        }
        text += character;
      }
    };
    try {
      for (const item of statement.items) {
        if (item.type === 'CallExpression') {
          const argument = evaluator.evaluate(item.arguments[0]) as number;
          if (item.name === 'TAB') {
            const position = printPosition(argument, width, item.location);
            append(' '.repeat(Math.max(0, position - this.#column)));
          } else {
            const character = printPosition(argument, 126, item.location);
            if (character !== 13 && character < 32)
              throw new BasicRuntimeError(
                'UNSUPPORTED_ALTAIR_CONTROL',
                'Unsupported CHR$ control',
                item.location.start,
                item.location.label,
              );
            append(String.fromCharCode(character));
          }
        } else {
          const value = evaluator.evaluate(item);
          append(
            typeof value === 'number'
              ? `${value < 0 ? '' : ' '}${String(value).replace(/^(-?)0\./, '$1.')} `
              : value,
          );
        }
      }
      if (!statement.trailingSemicolon) append('\n');
    } finally {
      if (text) write(text);
    }
  }

  async input(
    host: Pick<Host, 'readLine' | 'write'>,
    statement: InputStatement,
    signal: AbortSignal,
    commit: (target: AssignmentTarget, value: number) => void,
  ): Promise<void> {
    const targets = inputTargets(statement);
    let index = 0;
    for (;;) {
      const response = await readInputResponse(
        host,
        index === 0 ? '? ' : '?? ',
        statement.location,
        signal,
      );
      if (signal.aborted) return;
      this.reset();
      if (response.length > maxInputResponseLength)
        throw new BasicRuntimeError(
          'INPUT_LIMIT',
          `Altair INPUT permits at most ${maxInputResponseLength} response characters`,
          statement.location.start,
          statement.location.label,
        );
      if (response === '') return;
      const fields = response.split(',');
      for (const field of fields) {
        if (index === targets.length) {
          host.write('?EXTRA IGNORED\n');
          return;
        }
        const text = field.replace(/^[ \t]+|[ \t]+$/g, '');
        const prefix = numericPrefix.exec(text)?.[0] ?? '';
        const value = Number(prefix);
        commit(targets[index++], Number.isFinite(value) ? value : 0);
        if (prefix !== text || !Number.isFinite(value)) {
          host.write('?REDO FROM START\n');
          index = 0;
          break;
        }
      }
      if (index === targets.length) return;
    }
  }
}
