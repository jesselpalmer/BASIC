import {Readable} from 'node:stream';

export type TerminalInput = Readable & {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?(enabled: boolean): unknown;
};

// readline can throw before returning its interface. Keep every listener it
// installs on a private stream, with a fixed set of registrations on the source.
export default class ReadlineInput extends Readable {
  readonly isTTY: boolean | undefined;
  readonly #source: TerminalInput;
  readonly #originalRawMode: boolean;
  readonly #onFailure: (error: Error) => void;
  #released = false;
  #active = false;
  #rawModeChanged = false;

  constructor(source: TerminalInput, onError: (error: Error) => void) {
    super();
    this.#source = source;
    this.#originalRawMode = Boolean(source.isRaw);
    this.#onFailure = onError;
    this.isTTY = source.isTTY;
  }

  get isRaw(): boolean | undefined {
    return this.#source.isRaw;
  }

  attach(): void {
    this.#source.on('error', this.#onError);
    this.#source.on('close', this.#onClose);
    this.#source.on('end', this.#onEnd);
  }

  activate(): void {
    this.#active = true;
    // Adding data listeners can itself resume the source. Wait until readline
    // and the host both have their handlers before allowing that callback.
    this.#source.on('data', this.#onData);
    if (!this.#released && this.readableFlowing) this.#source.resume();
  }

  // Data is relayed synchronously, preserving complete lines delivered before a
  // source close or a reentrant prompt callback. There is no second input buffer.
  override _read(): void {}
  #onData = (chunk: Buffer | string): void => {
    this.emit('data', chunk);
  };
  #onError = (error: Error): void => {
    this.#onFailure(error);
  };
  #onClose = (): void => {
    this.emit('close');
  };
  #onEnd = (): void => {
    this.emit('end');
  };

  override pause(): this {
    super.pause();
    if (this.#active && !this.#released) this.#source.pause();
    return this;
  }

  override resume(): this {
    super.resume();
    if (this.#active && !this.#released) this.#source.resume();
    return this;
  }

  setRawMode(enabled: boolean): this {
    // A setter can partially change the mode before throwing.
    this.#rawModeChanged = true;
    if (enabled) this.#source.setRawMode?.(true);
    else this.#restoreMode(false);
    this.#rawModeChanged = enabled !== this.#originalRawMode;
    return this;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    this.#source.removeListener('data', this.#onData);
    this.#source.removeListener('end', this.#onEnd);
    this.#source.removeListener('error', this.#onError);
    this.#source.removeListener('close', this.#onClose);
    if (this.#rawModeChanged) {
      this.#rawModeChanged = false;
      this.#restoreMode();
    }
  }

  #restoreMode(enabled = this.#originalRawMode): void {
    try {
      this.#source.setRawMode?.(enabled);
    } catch {
      // A disconnected TTY can reject restoration as well as setup. It must
      // still release its listeners and preserve the original input failure.
    }
  }
}
