import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {Evaluator} from './evaluator.ts';
import {createHost} from './host.ts';
import {abortError, readInput} from './input.ts';
import {parseLine, parseProgram, validateProgram} from '../parser/parser.ts';
import type {
  Diagnostic,
  Host,
  InputOptions,
  ParsedLine,
  Program,
  RunResult,
  RunStatus,
  SourceOptions,
} from './types.ts';

const emptyProgram = validateProgram([]);

export default class Basic {
  #host: Host;
  #evaluator: Evaluator;
  #program: Program = emptyProgram;
  #index = 0;
  #status: RunStatus = 'ready';
  #current: ParsedLine | null = null;
  #diagnostic: Readonly<Diagnostic> | null = null;
  #executing = false;
  #immediate = false;
  #usedLabels = new Set<number>();
  #generation = 0;
  #pendingInput: AbortController | null = null;

  constructor(host: Partial<Host> = {}) {
    this.#host = Object.freeze(createHost(host));
    this.#evaluator = new Evaluator(this.#host);
  }

  get host(): Readonly<Host> {
    return this.#host;
  }

  get status(): RunStatus {
    return this.#status;
  }

  get state(): RunResult {
    const active = this.#status === 'ready' || this.#status === 'running';
    return Object.freeze({
      status: this.#status,
      currentLocation: this.#current?.statement.location ?? null,
      nextLocation:
        active && !this.#immediate
          ? (this.#program.lines[this.#index]?.statement.location ?? null)
          : null,
      diagnostic: this.#diagnostic,
    });
  }

  /** Prepare a fresh run, retaining the loaded program when omitted. */
  reset(program?: string | Program): RunResult {
    this.#assertIdle();
    this.#invalidateInput();
    this.#evaluator.reset();
    this.#index = 0;
    this.#status = 'ready';
    this.#current = null;
    this.#diagnostic = null;
    this.#immediate = false;
    this.#usedLabels.clear();
    try {
      if (typeof program === 'string') this.#program = parseProgram(program);
      else if (program !== undefined) this.#program = validateProgram(program.lines);
    } catch (error) {
      this.#recordFailure(error);
      throw error;
    }
    return this.state;
  }

  /** Run a fresh snapshot from its first line; omission reruns the loaded program. */
  run(program?: string | Program): RunResult {
    this.reset(program);
    while (this.#status === 'ready' || this.#status === 'running') this.step();
    return this.state;
  }

  async runAsync(program?: string | Program, options: InputOptions = {}): Promise<RunResult> {
    this.reset(program);
    const generation = this.#generation;
    while (this.#status === 'ready' || this.#status === 'running') {
      await this.stepAsync(options);
      if (generation !== this.#generation) throw abortError();
    }
    return this.state;
  }

  cancel(): RunResult {
    this.#assertIdle();
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    this.#invalidateInput();
    this.#status = 'halted';
    this.#diagnostic = null;
    return this.state;
  }

  step(): RunResult {
    this.#assertAvailable();
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    if (this.#immediate)
      throw new Error('Call reset before stepping a program after immediate input');
    const line = this.#program.lines[this.#index];
    if (!line) {
      this.#status = 'halted';
      return this.state;
    }
    this.#index++;
    this.#execute(line);
    if (this.#index === this.#program.lines.length) this.#status = 'halted';
    return this.state;
  }

  async stepAsync({signal}: InputOptions = {}): Promise<RunResult> {
    this.#assertAvailable();
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    this.#checkAbort(signal);
    const line = this.#program.lines[this.#index];
    if (this.#immediate || line?.statement.type !== 'InputStatement') return this.step();
    const generation = this.#generation;
    this.#index++;
    await this.#executeInput(line, signal);
    if (generation !== this.#generation) throw abortError();
    this.#checkAbort(signal);
    this.#status = 'running';
    if (this.#index === this.#program.lines.length) this.#status = 'halted';
    return this.state;
  }

  /** Transitional numbered-entry adapter until the stored editor replaces it. */
  readLine(source: string, options: SourceOptions = {}): RunResult {
    const line = this.#prepareImmediate(source, options);
    if (line) this.#execute(line);
    return this.state;
  }

  async readLineAsync(
    source: string,
    options: SourceOptions & InputOptions = {},
  ): Promise<RunResult> {
    this.#assertAvailable();
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    this.#checkAbort(options.signal);
    const generation = this.#generation;
    const line = this.#prepareImmediate(source, options);
    if (line?.statement.type === 'InputStatement') {
      await this.#executeInput(line, options.signal);
      if (generation !== this.#generation) throw abortError();
      this.#checkAbort(options.signal);
      this.#status = 'running';
    } else if (line) this.#execute(line);
    if (generation !== this.#generation) throw abortError();
    return this.state;
  }

  #prepareImmediate(source: string, options: SourceOptions): ParsedLine | null {
    this.#assertAvailable();
    if (this.#status === 'halted' || this.#status === 'error') return null;
    if (!this.#immediate && this.#status === 'running') {
      throw new Error('Call reset before mixing program steps and immediate input');
    }
    try {
      const line = parseLine(source, options);
      if (!line) return null;
      if (this.#usedLabels.has(line.label)) {
        throw new BasicSyntaxError(
          'DUPLICATE_LABEL',
          `Duplicate line label ${line.label}`,
          line.location.start,
          line.label,
        );
      }
      this.#usedLabels.add(line.label);
      this.#program = emptyProgram;
      this.#immediate = true;
      return line;
    } catch (error) {
      this.#recordFailure(error);
      throw error;
    }
  }

  #assertIdle(): void {
    if (this.#executing) throw new Error('Cannot change execution during a statement');
  }

  #assertAvailable(): void {
    this.#assertIdle();
    if (this.#status === 'waiting')
      throw new Error('Input is already pending; cancel or reset first');
  }

  #invalidateInput(): void {
    this.#generation++;
    const pending = this.#pendingInput;
    this.#pendingInput = null;
    this.#executing = true;
    try {
      pending?.abort();
    } finally {
      this.#executing = false;
    }
  }

  #checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      this.#status = 'halted';
      throw abortError();
    }
  }

  async #executeInput(line: ParsedLine, signal?: AbortSignal): Promise<void> {
    const statement = line.statement;
    if (statement.type !== 'InputStatement') throw new TypeError('Expected an INPUT statement');
    const generation = this.#generation;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) controller.abort();
    this.#pendingInput = controller;
    this.#current = line;
    this.#status = 'waiting';
    try {
      const value = await readInput(
        {
          readLine: (prompt, options) => {
            this.#executing = true;
            try {
              return this.#host.readLine(prompt, options);
            } finally {
              this.#executing = false;
            }
          },
          write: (text) => {
            this.#executing = true;
            try {
              this.#callHost('write', line, text);
            } finally {
              this.#executing = false;
            }
          },
        },
        statement,
        controller.signal,
      );
      if (generation !== this.#generation || controller.signal.aborted) throw abortError();
      this.#evaluator.assign(statement.target, value);
    } catch (error) {
      if (generation === this.#generation) {
        if (error instanceof Error && error.name === 'AbortError') this.#status = 'halted';
        else this.#recordFailure(error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (this.#pendingInput === controller) this.#pendingInput = null;
    }
  }

  #recordFailure(error: unknown): void {
    this.#status = 'error';
    this.#diagnostic =
      error instanceof BasicRuntimeError || error instanceof BasicSyntaxError
        ? Object.freeze({...error.diagnostic})
        : null;
  }

  #execute(line: ParsedLine): void {
    this.#current = line;
    this.#status = 'running';
    this.#executing = true;
    const statement = line.statement;
    try {
      switch (statement.type) {
        case 'InputStatement':
          throw new BasicRuntimeError(
            'ASYNC_INPUT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for INPUT',
            statement.location.start,
            line.label,
          );
        case 'LetStatement':
          this.#evaluator.assign(statement.target, this.#evaluator.evaluate(statement.expression));
          break;
        case 'PrintStatement': {
          const text = statement.items
            .map((item) => String(this.#evaluator.evaluate(item)))
            .join('');
          this.#callHost('write', line, text + (statement.trailingSemicolon ? '' : '\n'));
          break;
        }
        case 'ClsStatement':
          this.#callHost('clear', line);
          break;
        case 'RemStatement':
          break;
        case 'EndStatement':
          this.#status = 'halted';
          break;
      }
    } catch (error) {
      this.#recordFailure(error);
      throw error;
    } finally {
      this.#executing = false;
    }
  }

  #callHost(callback: 'write' | 'clear', line: ParsedLine, text = ''): void {
    try {
      if (callback === 'write') this.host.write(text);
      else this.host.clear();
    } catch (cause) {
      throw new BasicRuntimeError(
        'HOST_ERROR',
        `Host ${callback} failed`,
        line.statement.location.start,
        line.label,
        {cause},
      );
    }
  }
}
