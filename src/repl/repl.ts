import type {Host, InputOptions} from '../core/types.ts';
import Basic from '../basic.ts';
import constants from '../shared/constants.ts';
import {abortError, isAbortError} from '../core/cancellation.ts';
import StoredProgram from './program.ts';
import {parseFileCommand} from './file_command.ts';
import ProgramPersistence from './persistence.ts';
import type {ProgramFiles} from './program_files.ts';

export interface ReplHost extends Host {
  writeError(text: string): void;
}

export default class Repl {
  #operation: AbortController | null = null;
  #source = new StoredProgram();

  #persistence: ProgramPersistence | null;

  constructor(
    private host: ReplHost,
    files?: ProgramFiles,
  ) {
    this.#persistence = files ? new ProgramPersistence(this.#source, files) : null;
  }

  interrupt(): void {
    this.#operation?.abort();
  }

  async #withSignal<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.#operation = controller;
    try {
      return await action(controller.signal);
    } finally {
      this.#operation = null;
    }
  }

  #read(prompt: string): Promise<string | null> {
    return this.#withSignal(async (signal) => {
      const line = await this.host.readLine(prompt, {signal});
      signal.throwIfAborted();
      return line;
    });
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
          const fileCommand = parseFileCommand(line);
          if (fileCommand) {
            if (!this.#persistence) throw new Error('Program files are unavailable in this host');
            const persistence = this.#persistence;
            const warning = await this.#withSignal((signal) =>
              persistence.execute(
                fileCommand,
                async (prompt, signal) => {
                  const answer = await this.host.readLine(prompt, {signal});
                  signal.throwIfAborted();
                  return answer !== null && /^(?:y|yes)$/i.test(answer.trim());
                },
                signal,
              ),
            );
            if (warning) this.host.writeError(`${warning}\n`);
          } else if (command === 'RUN') {
            const snapshot = this.#source.document;
            const program = new Basic(this.host, {dialect: snapshot.dialect});
            await this.#withSignal((signal) => program.runAsync(snapshot.source, {signal}));
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
          } else if (/^[ \t]*\d/.test(line)) {
            this.#source.edit(line);
          } else {
            this.host.writeError(
              'Unknown session command. Use RUN, LIST, NEW, LOAD, SAVE, or EXIT.\n',
            );
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
