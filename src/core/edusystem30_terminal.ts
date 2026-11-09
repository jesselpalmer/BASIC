import {abortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import type {Evaluator} from './evaluator.ts';
import {inputTargets, maxInputResponseLength, readInput, readInputResponse} from './input.ts';
import type {InputStatement} from './input.ts';
import {signedNumericLiteral} from './numeric_literal.ts';
import type {BasicValue, Expression, Host} from './types.ts';

/** Sign and trailing padding observed in the EDUSYSTEM-30 numeric field. */
export function formatEduSystem30PrintItem(item: Expression, evaluator: Evaluator): string {
  // Source admission permits only the literal CHR$(7) terminal control.
  if (item.type === 'CallExpression' && item.name === 'CHR$') return '\x07';
  const value = evaluator.evaluate(item);
  if (typeof value === 'string') return value;
  return `${value < 0 ? '' : ' '}${value} `;
}

/** The numeric terminal retains unread fields across INPUT statements in one RUN. */
export class EduSystem30Input {
  #fields: RegExpStringIterator<RegExpMatchArray> | undefined;

  reset(): void {
    this.#fields = undefined;
  }

  async read(
    host: Pick<Host, 'readLine' | 'write'>,
    statement: InputStatement,
    signal: AbortSignal,
  ): Promise<readonly BasicValue[]> {
    if (statement.type === 'InputStatement' && statement.character)
      return readInput(host, statement, signal);

    const count = inputTargets(statement).length;
    const values: number[] = [];
    while (values.length < count) {
      const field = this.#fields?.next().value?.[0];
      if (field === undefined) {
        const text = await readInputResponse(host, '?', statement.location, signal);
        if (signal.aborted) throw abortError();
        if (text.length > maxInputResponseLength)
          throw new BasicRuntimeError(
            'INPUT_LIMIT',
            `EDUSYSTEM-30 INPUT permits at most ${maxInputResponseLength} response characters`,
            statement.location.start,
            statement.location.label,
          );
        this.#fields = text.replace(/[ \t]/g, '').matchAll(/[^,]+/g);
        continue;
      }
      const value = Number(field);
      if (signedNumericLiteral.test(field) && Number.isFinite(value)) values.push(value);
      else {
        this.reset();
        host.write('BAD DATA-RETYPE FROM ERROR.\n');
      }
    }
    return values;
  }
}
