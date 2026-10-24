import type {Host, InputOptions} from '../core/types.ts';
import type {Readable, Writable} from 'node:stream';
import type {Interface} from 'node:readline';
type Output = Writable & {isTTY?: boolean};
type Input = Readable & {isTTY?: boolean};
interface Streams {
  input?: Input;
  output?: Output;
  errorOutput?: Output;
}
interface Pending {
  resolve(value: string | null): void;
  reject(error: Error): void;
  cleanup(): void;
}
import {createInterface, cursorTo, clearScreenDown} from 'node:readline';

function abortError() {
  const error = new Error('Input cancelled');
  error.name = 'AbortError';
  return error;
}

export default class TerminalHost implements Host {
  _input?: Input;
  _output?: Output;
  _errorOutput?: Output;
  _lines: string[];
  _ended: boolean;
  _closed: boolean;
  _pending: Pending | null;
  _failure: Error | null;
  _interface: Interface | null;
  _onInterrupt: () => void;
  _onLine: (line: string) => void = () => {};
  _onClose: () => void = () => {};
  _onError: (error: Error) => void = () => {};
  _onSigint: () => void = () => {};
  write: (text: string) => boolean;
  writeError: (text: string) => boolean;
  random: () => number;
  clear: () => void;
  constructor({input, output, errorOutput}: Streams = {}) {
    this._input = input;
    this._output = output;
    this._errorOutput = errorOutput;
    this._lines = [];
    this._ended = false;
    this._closed = false;
    this._pending = null;
    this._failure = null;
    this._interface = null;
    this._onInterrupt = () => {};
    // These functions may be passed to a core host independently.
    this.write = (text) => (this._output || process.stdout).write(text);
    this.writeError = (text) => (this._errorOutput || process.stderr).write(text);
    this.clear = () => {
      const stream = this._output || process.stdout;
      if (stream.isTTY) {
        cursorTo(stream, 0, 0);
        clearScreenDown(stream);
      }
    };
    this.readLine = this.readLine.bind(this);
    this.random = Math.random;
  }

  setInterruptHandler(handler: () => void) {
    this._onInterrupt = handler;
  }

  _open(): Error | null {
    if (this._interface || this._closed) return this._failure;
    this._input = this._input || process.stdin;
    this._output = this._output || process.stdout;
    if (this._input.errored) {
      this._failure = this._input.errored;
      this.close();
      return this._failure;
    }
    if (this._input.readableEnded || this._input.destroyed) {
      this._ended = true;
      return null;
    }
    this._onLine = (line) => {
      if (this._pending) this._settle(null, line);
      else this._lines.push(line);
    };
    this._onClose = () => {
      this._ended = true;
      this._settle(null, null);
      this._detach();
      this._interface?.close();
    };
    this._onError = (error) => {
      this._failure = error;
      this.close();
    };
    this._onSigint = () => this._onInterrupt();
    this._interface = createInterface({
      input: this._input,
      output: this._output,
      terminal: Boolean(this._input.isTTY && this._output.isTTY),
      crlfDelay: Infinity,
    });
    this._interface.on('line', this._onLine);
    this._interface.on('close', this._onClose);
    this._interface.on('error', this._onError);
    this._interface.on('SIGINT', this._onSigint);
    this._input.on('error', this._onError);
    this._input.on('close', this._onClose);
    return this._failure;
  }

  _settle(error: Error | null, value: string | null = null) {
    const pending = this._pending;
    if (!pending) return;
    this._pending = null;
    pending.cleanup();
    if (error) pending.reject(error);
    else pending.resolve(value);
  }

  readLine(prompt = '', {signal}: InputOptions = {}): Promise<string | null> {
    if (signal && signal.aborted) return Promise.reject(abortError());
    if (this._pending) {
      return Promise.reject(new Error('Only one input request may be pending'));
    }
    if (this._failure) return Promise.reject(this._failure);
    if (this._closed) return Promise.resolve(null);
    try {
      const failure = this._open();
      if (failure) return Promise.reject(failure);
      this.write(prompt);
    } catch (error) {
      this.close();
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    if (this._lines.length) return Promise.resolve(this._lines.shift()!);
    if (this._ended) return Promise.resolve(null);
    return new Promise<string | null>((resolve, reject) => {
      const onAbort = () => this._settle(abortError());
      const cleanup = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
      };
      this._pending = {resolve, reject, cleanup};
      if (signal) {
        signal.addEventListener('abort', onAbort, {once: true});
        if (signal.aborted) onAbort();
      }
    });
  }

  _detach() {
    if (!this._interface) return;
    this._input?.removeListener('error', this._onError);
    this._input?.removeListener('close', this._onClose);
    this._interface.removeListener('line', this._onLine);
    this._interface.removeListener('close', this._onClose);
    this._interface.removeListener('error', this._onError);
    this._interface.removeListener('SIGINT', this._onSigint);
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._lines = [];
    this._settle(this._failure, null);
    if (this._interface) this._interface.close();
    this._detach();
    this._onInterrupt = () => {};
  }
}
