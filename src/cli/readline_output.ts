import {Writable} from 'node:stream';

export type TerminalOutput = Writable & {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
};

type WriteCallback = (error?: Error | null) => void;

// A failed readline constructor can retain resize listeners without returning
// an interface. Keep those on a private output with one owned source callback.
export default class ReadlineOutput extends Writable {
  readonly #source: TerminalOutput;

  constructor(source: TerminalOutput) {
    super();
    this.#source = source;
  }

  get columns(): number | undefined {
    return this.#source.columns;
  }

  get rows(): number | undefined {
    return this.#source.rows;
  }

  attach(): void {
    this.#source.on('resize', this.#onResize);
  }

  #onResize = (): void => {
    this.emit('resize');
  };

  // Preserve synchronous writes, thrown failures, callbacks, and backpressure;
  // a second Writable buffer would change readline's output/reentry behavior.
  override write(
    chunk: unknown,
    encodingOrCallback?: BufferEncoding | WriteCallback,
    callback?: WriteCallback,
  ): boolean {
    if (typeof encodingOrCallback === 'string') {
      return this.#source.write(chunk, encodingOrCallback, callback);
    }
    return this.#source.write(chunk, encodingOrCallback ?? callback);
  }

  release(): void {
    this.#source.removeListener('resize', this.#onResize);
  }
}
