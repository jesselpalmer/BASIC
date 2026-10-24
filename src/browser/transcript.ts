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

  get truncated(): boolean {
    return this.#truncated;
  }
}
