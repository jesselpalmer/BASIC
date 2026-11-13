import {abortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {
  eduSystem30FromNumber,
  eduSystem30OutputCode,
  isEduSystem30PrintableCode,
  observeEduSystem30,
  parseEduSystem30Input,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';
import {formatEduSystem30Number} from './edusystem30_format.ts';
import {inputTargets, maxInputResponseLength, readInput, readInputResponse} from './input.ts';
import type {InputStatement} from './input.ts';
import type {Expression, Host, NodeOf} from './types.ts';

const terminalWidth = 70;
const printZoneWidth = 14;

/** Sign and trailing padding observed in the EDUSYSTEM-30 numeric field. */
function formatPrintItem(
  item: Expression,
  evaluate: (expression: Expression) => EduSystem30FloatingValue,
): string {
  if (item.type === 'StringLiteral') return item.value;
  if (item.type === 'CallExpression' && item.name === 'CHR$') {
    const code = eduSystem30OutputCode(evaluate(item.arguments[0]));
    if (!isEduSystem30PrintableCode(code))
      throw new BasicRuntimeError(
        'NUMERIC_DOMAIN',
        'EDUSYSTEM-30 CHR$ requires a printable terminal character or BEL',
        item.location.start,
        item.location.label,
      );
    return String.fromCharCode(code);
  }
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

function tabColumn({significand, exponent}: EduSystem30FloatingValue): number {
  // Wrap before rounding. Using the stored dyadic value preserves the column
  // on either side of zero and avoids rounding at the host-number boundary.
  const places = 23 - exponent;
  const scale = 1n << BigInt(Math.max(places, 0));
  const units = significand << BigInt(Math.max(-places, 0));
  const width = BigInt(terminalWidth) * scale;
  const wrapped = ((units % width) + width) % width;
  return Number((wrapped + scale - 1n) / scale);
}

/** Column and unread input fields belong to one RUN. */
export class EduSystem30Terminal {
  #column = 0;
  #fields: RegExpStringIterator<RegExpMatchArray> | undefined;
  #characters = '';
  #characterIndex = 0;

  constructor(private readonly markInput = false) {}

  reset(): void {
    this.#column = 0;
    this.#fields = undefined;
    this.#clearCharacters();
  }

  #clearCharacters(): void {
    this.#characters = '';
    this.#characterIndex = 0;
  }

  print(
    statement: NodeOf<'PrintStatement'>,
    evaluate: (expression: Expression) => EduSystem30FloatingValue,
  ): string {
    let column = this.#column;
    let output = '';
    const advanceZones = (count: number) => {
      for (let remaining = count; remaining > 0; remaining--) {
        const target = (Math.floor(column / printZoneWidth) + 1) * printZoneWidth;
        if (target < terminalWidth) {
          output += ' '.repeat(target - column);
          column = target;
        } else {
          output += ' \n';
          column = 0;
        }
      }
    };
    const commas = statement.eduSystem30Commas;
    advanceZones(commas?.[0] ?? 0);
    for (const [index, item] of statement.items.entries()) {
      if (item.type === 'CallExpression' && item.name === 'TAB') {
        const target = tabColumn(evaluate(item.arguments[0]));
        if (target < column) {
          output += '\r\0';
          column = 0;
        }
        output += ' '.repeat(target - column);
        column = target;
      } else {
        const part = formatPrintItem(item, evaluate);
        output += part;
        for (const character of part)
          column = character === '\r' || character === '\n' ? 0 : column + 1;
      }
      advanceZones(commas?.[index + 1] ?? 0);
    }
    const continues = statement.trailingSemicolon || (commas?.at(-1) ?? 0) > 0;
    this.#column = continues ? column : 0;
    return output + (continues ? '' : '\n');
  }

  async #readCharacter(
    host: Pick<Host, 'readLine' | 'write'>,
    statement: NodeOf<'InputStatement'> | NodeOf<'InputTargetsStatement'>,
    signal: AbortSignal,
  ): Promise<number> {
    if (this.#characters) {
      const code = this.#characters.charCodeAt(this.#characterIndex++);
      if (this.#characterIndex === this.#characters.length) this.#clearCharacters();
      return code;
    }

    if (statement.type === 'InputTargetsStatement') {
      for (;;) {
        const text = await readInputResponse(host, '', statement.location, signal);
        if (signal.aborted) throw abortError();
        if (text.length > maxInputResponseLength)
          throw new BasicRuntimeError(
            'INPUT_LIMIT',
            `EDUSYSTEM-30 INPUT permits at most ${maxInputResponseLength} response characters`,
            statement.location.start,
            statement.location.label,
          );
        if (!/[^\x20-\x7e]/.test(text)) {
          if (!text) return 13;
          // The host submits a whole line. Retain its unread characters and Return
          // for later INPUT statements in this run.
          this.#characters = text + '\r';
          this.#characterIndex = 1;
          return text.charCodeAt(0);
        }
        this.#column = 0;
        host.write('\nEnter an ASCII line.\n');
      }
    }

    const [code] = await readInput(
      {
        ...host,
        write: (text) => {
          if (signal.aborted) throw abortError();
          this.#column = 0;
          host.write(text);
        },
      },
      statement,
      signal,
    );
    return Number(code);
  }

  async read(
    host: Pick<Host, 'readLine' | 'write'>,
    statement: InputStatement,
    signal: AbortSignal,
  ): Promise<readonly EduSystem30FloatingValue[]> {
    if (
      (statement.type === 'InputStatement' || statement.type === 'InputTargetsStatement') &&
      statement.character
    ) {
      const code = await this.#readCharacter(host, statement, signal);
      if (signal.aborted) throw abortError();
      // The archive echoes a character into the column counter, even Return.
      this.#column++;
      return [eduSystem30FromNumber(code | (this.markInput ? 0x80 : 0))];
    }

    const count = inputTargets(statement).length;
    const values: EduSystem30FloatingValue[] = [];
    while (values.length < count) {
      const field = this.#fields?.next().value?.[0];
      if (field === undefined) {
        let text: string;
        if (this.#characters) {
          host.write('?');
          text = this.#characters.slice(this.#characterIndex, -1);
          this.#clearCharacters();
        } else {
          text = await readInputResponse(host, '?', statement.location, signal);
          if (signal.aborted) throw abortError();
        }
        this.#column = 0;
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
      this.#fields = undefined;
      this.#column = 0;
      host.write('BAD DATA-RETYPE FROM ERROR.\n');
    }
    return values;
  }
}
