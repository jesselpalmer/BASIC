import {abortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {
  eduSystem30FromNumber,
  observeEduSystem30,
  parseEduSystem30Input,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';
import {formatEduSystem30Number} from './edusystem30_format.ts';
import {inputTargets, maxInputResponseLength, readInput, readInputResponse} from './input.ts';
import type {InputStatement} from './input.ts';
import type {Expression, Host} from './types.ts';

/** Sign and trailing padding observed in the EDUSYSTEM-30 numeric field. */
export function formatEduSystem30PrintItem(
  item: Expression,
  evaluate: (expression: Expression) => EduSystem30FloatingValue,
): string {
  if (item.type === 'StringLiteral') return item.value;
  // Source admission permits only the literal CHR$(7) terminal control.
  if (item.type === 'CallExpression' && item.name === 'CHR$') return '\x07';
  const value = evaluate(item);
  try {
    return formatEduSystem30Number(value);
  } catch (cause) {
    throw new BasicRuntimeError(
      'NON_FINITE_NUMBER',
      'EDUSYSTEM-30 numeric PRINT is outside its supported range',
      item.location.start,
      item.location.label,
      {cause},
    );
  }
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
  ): Promise<readonly EduSystem30FloatingValue[]> {
    if (statement.type === 'InputStatement' && statement.character)
      return (await readInput(host, statement, signal)).map((value) =>
        eduSystem30FromNumber(Number(value)),
      );

    const count = inputTargets(statement).length;
    const values: EduSystem30FloatingValue[] = [];
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
      try {
        const value = parseEduSystem30Input(field);
        if (Number.isFinite(observeEduSystem30(value))) {
          values.push(value);
          continue;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError || error instanceof RangeError)) throw error;
      }
      this.reset();
      host.write('BAD DATA-RETYPE FROM ERROR.\n');
    }
    return values;
  }
}
