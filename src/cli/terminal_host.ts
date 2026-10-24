import {abortError} from '../core/cancellation.ts';
import {createInterface, cursorTo, clearScreenDown} from 'node:readline';
import type {Interface} from 'node:readline';
import type {Readable, Writable} from 'node:stream';
import type {Host, InputOptions} from '../core/types.ts';

type TerminalOutput = Writable & {isTTY?: boolean};
type TerminalInput = Readable & {isTTY?: boolean};

interface TerminalStreams {
  input?: TerminalInput;
  output?: TerminalOutput;
  errorOutput?: TerminalOutput;
}

interface PendingRead {
  ready: boolean;
  resolve(value: string | null): void;
  reject(error: Error): void;
  cleanup(): void;
}

export default class TerminalHost implements Host {
  #input?: TerminalInput;
  #output?: TerminalOutput;
  readonly #errorOutput?: TerminalOutput;
  #queuedLines: string[] = [];
  #ended = false;
  #closed = false;
  #pendingRead: PendingRead | null = null;
  #failure: Error | null = null;
  #readline: Interface | null = null;
  #openingInput = false;
  #interruptHandler: (() => void) | null = null;

  // Host callbacks stay bound when passed independently to the interpreter.
  write = (text: string): boolean => (this.#output ?? process.stdout).write(text);
  writeError = (text: string): boolean => (this.#errorOutput ?? process.stderr).write(text);
  random = Math.random;
  clear = (): void => {
    const stream = this.#output ?? process.stdout;
    if (stream.isTTY) {
      cursorTo(stream, 0, 0);
      clearScreenDown(stream);
    }
  };

  constructor({input, output, errorOutput}: TerminalStreams = {}) {
    // Do not access process.stdin until readLine: file runs may need no input.
    this.#input = input;
    this.#output = output;
    this.#errorOutput = errorOutput;
  }

  discardEntry(): void {
    if (!this.#readline) return;
    if (this.#input?.isTTY && this.#output?.isTTY) {
      // readline exposes the editable line/cursor; reset both so a partial
      // cancelled entry cannot prefix the next command.
      Object.assign(this.#readline, {line: '', cursor: 0});
    } else {
      // Non-TTY readline keeps its unfinished chunk outside the editable TTY
      // line. Replace only that interface, retaining queued complete lines and
      // ownership of the live input stream.
      this.#releaseReadline();
      this.#openInput();
    }
  }

  setInterruptHandler(handler: () => void): void {
    this.#interruptHandler = handler;
  }

  readLine = (prompt = '', {signal}: InputOptions = {}): Promise<string | null> => {
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.#pendingRead) {
      return Promise.reject(new Error('Only one input request may be pending'));
    }
    if (this.#failure) return Promise.reject(this.#failure);
    if (this.#closed) return Promise.resolve(null);
    return new Promise<string | null>((resolve, reject) => {
      // Reserve ownership before opening streams or writing: either can invoke
      // caller callbacks synchronously, including another read or cancellation.
      const onAbort = () => {
        if (this.#pendingRead === pending) this.#settleRead(abortError());
      };
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const pending: PendingRead = {ready: false, resolve, reject, cleanup};
      this.#pendingRead = pending;
      if (signal) {
        signal.addEventListener('abort', onAbort, {once: true});
        if (signal.aborted) onAbort();
      }
      const start = () => {
        if (this.#pendingRead !== pending) return;
        try {
          this.#openInput();
          if (this.#pendingRead !== pending) return;
          this.write(prompt);
        } catch (error) {
          // A cancelled callback may have started a new read before throwing.
          // Its old setup no longer owns the host or the replacement request.
          if (this.#pendingRead !== pending) return;
          this.#settleRead(error instanceof Error ? error : new Error(String(error)));
          this.close();
          return;
        }
        if (this.#pendingRead !== pending) return;
        // Stage lines received during setup until the prompt succeeds. A prompt
        // failure must reject, even if its callback supplied input before throwing.
        pending.ready = true;
        if (this.#queuedLines.length) this.#settleRead(null, this.#queuedLines.shift());
        else if (this.#ended) this.#settleRead(null);
      };
      // A stream constructor hook may abort and replace its read. Delay the
      // replacement prompt until that constructor has attached line listeners.
      if (this.#openingInput) queueMicrotask(start);
      else start();
    });
  };

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#ended = true;
    this.#queuedLines = [];
    this.#settleRead(this.#failure);
    this.#releaseReadline();
    this.#interruptHandler = null;
  }

  #onLine = (line: string): void => {
    if (this.#pendingRead?.ready) this.#settleRead(null, line);
    else this.#queuedLines.push(line);
  };

  #onClose = (): void => {
    this.#ended = true;
    if (this.#pendingRead?.ready) this.#settleRead(null);
    this.#releaseReadline();
  };

  #onError = (error: Error): void => {
    this.#failure = error;
    this.close();
  };

  #onSigint = (): void => this.#interruptHandler?.();

  #openInput(): void {
    if (this.#readline || this.#openingInput || this.#ended || this.#closed) return;
    this.#openingInput = true;
    try {
      this.#input ??= process.stdin;
      this.#output ??= process.stdout;
      if (this.#input.errored) {
        this.#failure = this.#input.errored;
        this.close();
        return;
      }
      if (this.#input.readableEnded || this.#input.destroyed) {
        this.#ended = true;
        return;
      }
      this.#readline = createInterface({
        input: this.#input,
        output: this.#output,
        terminal: Boolean(this.#input.isTTY && this.#output.isTTY),
        crlfDelay: Infinity,
      });
      // Stream hooks such as setRawMode can close the host during construction,
      // before the new interface can be assigned and disposed by close().
      if (this.#closed) {
        this.#releaseReadline();
        return;
      }
      this.#readline.on('line', this.#onLine);
      this.#readline.on('close', this.#onClose);
      this.#readline.on('error', this.#onError);
      this.#readline.on('SIGINT', this.#onSigint);
      this.#input.on('error', this.#onError);
      this.#input.on('close', this.#onClose);
    } finally {
      this.#openingInput = false;
    }
  }

  #settleRead(error: Error | null, value: string | null = null): void {
    const pending = this.#pendingRead;
    if (!pending) return;
    this.#pendingRead = null;
    pending.cleanup();
    if (error) pending.reject(error);
    else pending.resolve(value);
  }

  #releaseReadline(): void {
    const readline = this.#readline;
    if (!readline) return;
    this.#readline = null;
    this.#input?.removeListener('error', this.#onError);
    this.#input?.removeListener('close', this.#onClose);
    readline.removeListener('line', this.#onLine);
    readline.removeListener('close', this.#onClose);
    readline.removeListener('error', this.#onError);
    readline.removeListener('SIGINT', this.#onSigint);
    // Detach first: closing a replaced interface must not mark live input ended.
    readline.close();
  }
}
