/** A character-bounded tail of output, independent of DOM rendering frequency. */
export class Transcript {
  #text = '';
  #truncated = false;
  readonly limit: number;

  constructor(limit = 50_000) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('Transcript limit must be a positive safe integer');
    }
    this.limit = limit;
  }

  append(text: string): void {
    if (text.length === 0) return;
    const available = this.limit - Math.min(text.length, this.limit);
    if (this.#text.length + text.length > this.limit) this.#truncated = true;
    // Slice before concatenating so even a single huge PRINT cannot grow our retained buffer.
    this.#text =
      this.#text.slice(Math.max(0, this.#text.length - available)) + text.slice(-this.limit);
  }

  clear(): void {
    this.#text = '';
    this.#truncated = false;
  }

  get text(): string {
    return this.#text;
  }

  /** Present EDUSYSTEM-30 backward TAB as a carriage return on a paper terminal. */
  get paperText(): string {
    // A bounded tail can begin between the carriage return and its padding byte.
    const text = this.#truncated && this.#text.startsWith('\0') ? this.#text.slice(1) : this.#text;
    if (!text.includes('\r\0')) return text;
    return text
      .split('\n')
      .map((line) => {
        const [initial, ...returns] = line.split('\r\0');
        if (returns.length === 0) return initial;
        const columns = [...initial];
        for (const overprint of returns) {
          let column = 0;
          for (const mark of overprint) {
            // Spaces advance the carriage without erasing marks already on paper.
            if (mark !== ' ' || column >= columns.length) columns[column] = mark;
            column++;
          }
        }
        return columns.join('');
      })
      .join('\n');
  }

  get truncated(): boolean {
    return this.#truncated;
  }
}
