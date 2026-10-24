import type {Program} from '../core/types.ts';
import {parseLine} from '../parser/parser.ts';
import {tokenize} from '../parser/tokenizer.ts';

/** Editable source is independent of a running interpreter snapshot. */
export default class StoredProgram {
  #lines = new Map<number, string>();
  #baseline = '';
  #filename: string | null = null;

  get source(): string {
    return [...this.#lines.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, source]) => source)
      .join('\n');
  }

  get dirty(): boolean {
    return this.source !== this.#baseline;
  }

  get filename(): string | null {
    return this.#filename;
  }

  replace(program: Program, filename: string): void {
    this.#lines = new Map(program.lines.map((line) => [line.label, line.source]));
    this.saved(filename);
  }

  saved(filename: string): void {
    this.#baseline = this.source;
    this.#filename = filename;
  }

  edit(source: string): void {
    if (/^[ \t]*\d+[ \t]*$/.test(source)) {
      tokenize(source); // Reuse the scanner's range validation for bare labels.
      this.#lines.delete(Number(source));
      return;
    }
    const line = parseLine(source);
    if (line) this.#lines.set(line.label, line.source);
  }

  clear(): void {
    this.#lines.clear();
    this.#baseline = '';
    this.#filename = null;
  }
}
