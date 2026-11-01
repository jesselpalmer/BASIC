import type {Program} from '../core/types.ts';
import {parseLine} from '../parser/parser.ts';
import {tokenize} from '../parser/tokenizer.ts';
import {createSourceDocument} from '../core/source_document.ts';
import type {SourceDocument} from '../core/source_document.ts';
import {validateDialect} from '../core/dialect.ts';
import type {Dialect} from '../core/types.ts';

/** Editable source is independent of a running interpreter snapshot. */
export default class StoredProgram {
  #lines = new Map<number, string>();
  #baseline = '';
  #filename: string | null = null;
  #dialect: Dialect = 'native';
  #baselineDialect: Dialect = 'native';
  #verbatim: string | null = null;

  get source(): string {
    return (
      this.#verbatim ??
      [...this.#lines.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, source]) => source)
        .join('\n')
    );
  }

  get dirty(): boolean {
    return this.source !== this.#baseline || this.#dialect !== this.#baselineDialect;
  }

  get document(): SourceDocument {
    return createSourceDocument(this.source, {dialect: this.#dialect});
  }

  get filename(): string | null {
    return this.#filename;
  }

  /** Persistence supplies exact source only after validating the same candidate. */
  replace(program: Program, filename: string, verbatim?: string): void {
    const dialect = validateDialect(program.dialect);
    this.#lines = new Map(program.lines.map((line) => [line.label, line.source]));
    this.#dialect = dialect;
    this.#verbatim = verbatim ?? null;
    this.saved(filename);
  }

  saved(filename: string): void {
    this.#baseline = this.source;
    this.#baselineDialect = this.#dialect;
    this.#filename = filename;
  }

  edit(source: string): void {
    if (/^[ \t]*\d+[ \t]*$/.test(source)) {
      tokenize(source); // Reuse the scanner's range validation for bare labels.
      if (this.#lines.delete(Number(source))) this.#verbatim = null;
      return;
    }
    const line = parseLine(source, {dialect: this.#dialect});
    if (line && this.#lines.get(line.label) !== line.source) {
      this.#lines.set(line.label, line.source);
      this.#verbatim = null;
    }
  }

  clear(): void {
    this.#lines.clear();
    this.#baseline = '';
    this.#filename = null;
    this.#dialect = 'native';
    this.#baselineDialect = 'native';
    this.#verbatim = null;
  }
}
