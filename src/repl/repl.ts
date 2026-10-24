import type {Host, InputOptions} from '../core/types.ts';
import Basic from '../basic.ts';
import constants from '../shared/constants.ts';
import {abortError, isAbortError} from '../core/cancellation.ts';
import StoredProgram from './program.ts';

export interface ReplHost extends Host {
  writeError(text: string): void;
}

export default class Repl {
  #operation: AbortController | null = null;
  #source = new StoredProgram();

  constructor(private host: ReplHost) {}

  interrupt(): void {
    this.#operation?.abort();
  }

  async #withSignal<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.#operation = controller;
    try {
      const result = await action(controller.signal);
      if (controller.signal.aborted) throw abortError();
      return result;
    } finally {
      this.#operation = null;
    }
  }

  #read(prompt: string): Promise<string | null> {
    return this.#withSignal((signal) => this.host.readLine(prompt, {signal}));
  }

  #finish(eof: boolean): number {
    const dirty = eof && this.#source.dirty;
    if (dirty) {
      this.host.writeError(
        `Unsaved program at EOF; copy the source below before closing:\n${this.#source.source}\n`,
      );
    }
    this.host.write(`${constants.Strings.Repl.EXIT_MESSAGE}\n`);
    return dirty ? 1 : 0;
  }

  async start({signal}: InputOptions = {}): Promise<number> {
    const program = new Basic(this.host);
    const onAbort = () => this.interrupt();
    signal?.addEventListener('abort', onAbort, {once: true});
    try {
      this.host.write(`${constants.Strings.Repl.WELCOME_MESSAGE}\n`);
      for (;;) {
        if (signal?.aborted) throw abortError();
        let line: string | null;
        try {
          line = await this.#read(constants.Strings.Repl.PROMPT);
        } catch (error) {
          if (!isAbortError(error)) throw error;
          if (signal?.aborted) throw error;
          this.host.write('\n');
          continue;
        }
        if (signal?.aborted) throw abortError();
        if (line === null) return this.#finish(true);
        const command = line.trim().toUpperCase();
        if (command === '') continue;
        try {
          if (command === 'RUN') {
            const snapshot = this.#source.source;
            await this.#withSignal((signal) => program.runAsync(snapshot, {signal}));
          } else if (command === 'LIST') {
            const source = this.#source.source;
            if (source !== '') this.host.write(source + '\n');
          } else if (command === 'NEW' || command === 'EXIT') {
            if (this.#source.dirty) {
              const action = command === 'NEW' ? 'start a new program' : 'exit';
              const answer = await this.#read(`Discard unsaved changes and ${action}? [y/N] `);
              if (answer === null) return this.#finish(true);
              if (!/^(?:y|yes)$/i.test(answer.trim())) continue;
            }
            if (command === 'EXIT') return this.#finish(false);
            this.#source.clear();
            program.reset('');
          } else if (/^[ \t]*\d/.test(line)) {
            this.#source.edit(line);
          } else {
            this.host.writeError('Unknown session command. Use RUN, LIST, NEW, or EXIT.\n');
          }
        } catch (error) {
          if (isAbortError(error)) {
            if (signal?.aborted) throw error;
            this.host.write('\n');
          } else {
            this.host.writeError(`${error instanceof Error ? error.message : String(error)}\n`);
          }
        }
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
