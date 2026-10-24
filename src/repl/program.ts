import {parseLine} from '../parser/parser.ts';
import {tokenize} from '../parser/tokenizer.ts';

/** Editable source is independent of a running interpreter snapshot. */
export default class StoredProgram {
  #lines = new Map<number, string>();

  get source(): string {
    return [...this.#lines.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, source]) => source)
      .join('\n');
  }

  get dirty(): boolean {
    // Until LOAD/SAVE is added, the only clean baseline is an empty program.
    return this.#lines.size > 0;
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
  }
}
