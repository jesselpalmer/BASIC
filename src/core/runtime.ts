import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {abortable, abortError, isAbortError} from './cancellation.ts';
import {ControlFlow} from './control_flow.ts';
import {Evaluator} from './evaluator.ts';
import {GraphicsState} from './graphics.ts';
import {createHost} from './host.ts';
import {validateDialect} from './dialect.ts';
import {readInput} from './input.ts';
import {waitFor} from './wait.ts';
import {prepareProgram} from './prepared_program.ts';
import type {PreparedProgram} from './prepared_program.ts';
import {defaultScheduler, yieldExecution} from './scheduling.ts';
import {parseLine} from '../parser/parser.ts';
import type {
  Diagnostic,
  Dialect,
  LanguageOptions,
  Host,
  InputOptions,
  ParsedLine,
  Program,
  RunResult,
  RunOptions,
  RunStatus,
  SourceOptions,
  VariableSnapshot,
  ArraySnapshot,
  NodeOf,
} from './types.ts';

export default class Basic {
  readonly #dialect: Dialect;
  readonly #emptyProgram: PreparedProgram;
  readonly #host: Host;
  readonly #evaluator: Evaluator;
  readonly #graphics = new GraphicsState();
  #prepared: PreparedProgram;
  #controlFlow: ControlFlow;
  #status: RunStatus = 'ready';
  #current: ParsedLine | null = null;
  #diagnostic: Readonly<Diagnostic> | null = null;
  #executing = false;
  #immediate = false;
  #usedLabels = new Set<number>();
  // Reset/cancel change this token before old suspended work can touch new state.
  #generation = 0;
  #pendingStatement: AbortController | null = null;
  // An async driver owns stepping until its promise settles, including yields.
  #activeRun: AbortController | null = null;

  constructor(host: Partial<Host> = {}, options: LanguageOptions = {}) {
    this.#dialect = validateDialect(options.dialect);
    this.#emptyProgram = prepareProgram('', this.#dialect);
    this.#prepared = this.#emptyProgram;
    this.#host = Object.freeze(createHost(host));
    this.#evaluator = new Evaluator(this.#host, {dialect: this.#dialect});
    this.#controlFlow = new ControlFlow(this.#prepared, this.#evaluator);
  }

  get host(): Readonly<Host> {
    return this.#host;
  }

  get dialect(): Dialect {
    return this.#dialect;
  }

  get status(): RunStatus {
    return this.#status;
  }

  get variables(): readonly VariableSnapshot[] {
    return this.#evaluator.snapshotVariables();
  }

  get arrays(): readonly ArraySnapshot[] {
    return this.#evaluator.snapshotArrays();
  }

  get state(): RunResult {
    const active = this.#status === 'ready' || this.#status === 'running';
    return Object.freeze({
      status: this.#status,
      currentLocation: this.#current?.statement.location ?? null,
      nextLocation:
        active && !this.#immediate
          ? (this.#controlFlow.nextLine?.statement.location ?? null)
          : null,
      diagnostic: this.#diagnostic,
    });
  }

  /** Prepare a fresh run, retaining the loaded program when omitted. */
  reset(program?: string | Program): RunResult {
    this.#assertIdle();
    this.#invalidateExecution();
    this.#evaluator.reset();
    this.#graphics.reset();
    this.#status = 'ready';
    this.#current = null;
    this.#diagnostic = null;
    this.#immediate = false;
    this.#usedLabels.clear();
    try {
      // A failed candidate leaves both the previous snapshot and its tables intact.
      const candidate =
        program === undefined ? this.#prepared : prepareProgram(program, this.#dialect);
      this.#evaluator.reset(candidate.arrayDeclarations);
      this.#prepared = candidate;
      this.#controlFlow = new ControlFlow(this.#prepared, this.#evaluator);
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

  async runAsync(program?: string | Program, options: RunOptions = {}): Promise<RunResult> {
    const {
      signal,
      instructionLimit,
      yieldEvery = 256,
      scheduler = defaultScheduler,
      beforeStatement,
    } = options;
    if (
      instructionLimit !== undefined &&
      (!Number.isSafeInteger(instructionLimit) || instructionLimit < 0)
    )
      throw new TypeError('instructionLimit must be a nonnegative safe integer');
    if (!Number.isSafeInteger(yieldEvery) || yieldEvery < 1)
      throw new TypeError('yieldEvery must be a positive safe integer');
    if (typeof scheduler !== 'function') throw new TypeError('scheduler must be a function');
    if (beforeStatement !== undefined && typeof beforeStatement !== 'function')
      throw new TypeError('beforeStatement must be a function');
    this.reset(program);
    const generation = this.#generation;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) controller.abort();
    this.#activeRun = controller;
    let executed = 0;
    let statementsSinceYield = 0;
    try {
      this.#checkAbort(controller.signal);
      while (this.#status === 'ready' || this.#status === 'running') {
        const line = this.#controlFlow.nextLine;
        if (line && executed === instructionLimit) {
          this.#current = line;
          throw new BasicRuntimeError(
            'INSTRUCTION_LIMIT',
            `Instruction limit of ${instructionLimit} reached`,
            line.statement.location.start,
            line.label,
          );
        }
        if (beforeStatement && line) {
          try {
            const gate = beforeStatement(controller.signal);
            if (gate) {
              // Consume even a gate returned by a callback that synchronously cancels this run.
              void gate.catch(() => {});
              await abortable(() => gate, controller.signal, 'Statement gate failed');
            }
          } catch (cause) {
            if (generation !== this.#generation || controller.signal.aborted) throw abortError();
            this.#current = line;
            throw new BasicRuntimeError(
              'STATEMENT_GATE_FAILED',
              'Statement gate failed',
              line.statement.location.start,
              line.label,
              {cause},
            );
          }
          if (generation !== this.#generation) throw abortError();
          this.#checkAbort(controller.signal);
        }
        await this.#stepAsync(controller.signal);
        if (generation !== this.#generation) throw abortError();
        this.#checkAbort(controller.signal);
        executed++;
        // WAIT already yields a task. Begin a fresh batch so the next small
        // animation frame is not split because of work before that boundary.
        statementsSinceYield =
          line?.statement.type === 'WaitStatement' ? 0 : statementsSinceYield + 1;
        if (
          (this.#status === 'ready' || this.#status === 'running') &&
          statementsSinceYield >= yieldEvery &&
          executed !== instructionLimit
        ) {
          try {
            await yieldExecution(scheduler, controller.signal);
            statementsSinceYield = 0;
          } catch (cause) {
            if (generation !== this.#generation || controller.signal.aborted) throw abortError();
            const next = this.#controlFlow.nextLine!;
            this.#current = next;
            throw new BasicRuntimeError(
              'SCHEDULER_FAILED',
              'Execution scheduler failed',
              next.statement.location.start,
              next.label,
              {cause},
            );
          }
          if (generation !== this.#generation) throw abortError();
          this.#checkAbort(controller.signal);
        }
      }
      return this.state;
    } catch (error) {
      if (generation === this.#generation) {
        if (isAbortError(error)) this.#halt();
        else this.#recordFailure(error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (this.#activeRun === controller) this.#activeRun = null;
    }
  }

  cancel(): RunResult {
    this.#assertIdle();
    if (this.#status === 'error' || (this.#status === 'halted' && !this.#activeRun))
      return this.state;
    this.#invalidateExecution();
    this.#halt();
    this.#diagnostic = null;
    return this.state;
  }

  step(): RunResult {
    this.#assertAvailable();
    return this.#step();
  }

  #step(): RunResult {
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    if (this.#immediate)
      throw new Error('Call reset before stepping a program after immediate input');
    const line = this.#controlFlow.takeLine();
    if (!line) {
      this.#halt();
      return this.state;
    }
    this.#execute(line);
    if (!this.#controlFlow.nextLine) {
      this.#halt();
    }
    return this.state;
  }

  async stepAsync({signal}: InputOptions = {}): Promise<RunResult> {
    this.#assertAvailable();
    return this.#stepAsync(signal);
  }

  async #stepAsync(signal?: AbortSignal): Promise<RunResult> {
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    this.#checkAbort(signal);
    const line = this.#controlFlow.nextLine;
    if (
      this.#immediate ||
      (line?.statement.type !== 'InputStatement' && line?.statement.type !== 'WaitStatement')
    )
      return this.#step();
    const generation = this.#generation;
    this.#controlFlow.takeLine();
    await this.#executeSuspension(line, line.statement, signal);
    if (generation !== this.#generation) throw abortError();
    this.#checkAbort(signal);
    this.#status = 'running';
    if (!this.#controlFlow.nextLine) {
      this.#halt();
    }
    return this.state;
  }

  /** Legacy immediate execution for library callers, separate from terminal editing. */
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
    if (line?.statement.type === 'InputStatement' || line?.statement.type === 'WaitStatement') {
      await this.#executeSuspension(line, line.statement, options.signal);
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
      if (options.dialect !== undefined) validateDialect(options.dialect, this.#dialect);
      const line = parseLine(source, {...options, dialect: this.#dialect});
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
      this.#prepared = this.#emptyProgram;
      this.#controlFlow = new ControlFlow(this.#prepared, this.#evaluator);
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
      throw new Error(
        `${this.#current?.statement.type === 'WaitStatement' ? 'WAIT' : 'Input'} is already pending; cancel or reset first`,
      );
    if (this.#activeRun && this.#status !== 'halted' && this.#status !== 'error')
      throw new Error('An async run is active; cancel or reset before stepping or immediate input');
  }

  #invalidateExecution(): void {
    this.#generation++;
    const pending = this.#pendingStatement;
    const run = this.#activeRun;
    // Release ownership before abort listeners run synchronously. Those callbacks
    // receive the same reentrancy protection as callbacks during a statement.
    this.#pendingStatement = null;
    this.#activeRun = null;
    this.#executing = true;
    try {
      pending?.abort();
      run?.abort();
    } finally {
      this.#executing = false;
    }
  }

  #checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      this.#halt();
      throw abortError();
    }
  }

  async #executeSuspension(
    line: ParsedLine,
    statement: NodeOf<'InputStatement'> | NodeOf<'WaitStatement'>,
    signal?: AbortSignal,
  ): Promise<void> {
    const generation = this.#generation;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) controller.abort();
    this.#pendingStatement = controller;
    this.#current = line;
    this.#status = 'waiting';
    try {
      if (statement.type === 'WaitStatement') {
        // waitFor evaluates and calls the host before its first await, so the
        // same synchronous callback guard covers both phases of this statement.
        let pending: Promise<void>;
        this.#executing = true;
        try {
          pending = waitFor(this.#host, this.#evaluator, statement, controller.signal);
        } finally {
          this.#executing = false;
        }
        await pending;
      } else {
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
      }
    } catch (error) {
      if (generation === this.#generation) {
        if (isAbortError(error)) {
          this.#halt();
        } else this.#recordFailure(error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (this.#pendingStatement === controller) this.#pendingStatement = null;
    }
  }

  #recordFailure(error: unknown): void {
    this.#controlFlow.clearLoops();
    this.#status = 'error';
    this.#diagnostic =
      error instanceof BasicRuntimeError || error instanceof BasicSyntaxError
        ? Object.freeze({...error.diagnostic})
        : null;
  }

  #halt(): void {
    this.#controlFlow.clearLoops();
    this.#status = 'halted';
  }

  #execute(line: ParsedLine): void {
    this.#current = line;
    this.#status = 'running';
    this.#executing = true;
    const statement = line.statement;
    try {
      if (
        this.#immediate &&
        (statement.type === 'DimStatement' ||
          statement.type === 'IfStatement' ||
          statement.type === 'GotoStatement' ||
          statement.type === 'ForStatement' ||
          statement.type === 'NextStatement')
      ) {
        throw new BasicRuntimeError(
          'PROGRAM_REQUIRED',
          'DIM, IF, GOTO, FOR, and NEXT require a complete program; use run or runAsync',
          statement.location.start,
          line.label,
        );
      }
      switch (statement.type) {
        case 'ForStatement':
          this.#controlFlow.beginLoop(statement);
          break;
        case 'NextStatement':
          this.#controlFlow.nextLoop(statement);
          break;
        case 'GotoStatement':
          this.#controlFlow.jump(statement.target.value, statement.target.location);
          break;
        case 'IfStatement':
          if (this.#evaluator.compare(statement.condition))
            this.#controlFlow.jump(statement.target.value, statement.target.location);
          break;
        case 'WaitStatement':
          throw new BasicRuntimeError(
            'ASYNC_WAIT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for WAIT',
            statement.location.start,
            line.label,
          );
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
        case 'ColorStatement':
        case 'PsetStatement':
        case 'LineStatement':
        case 'CircleStatement':
          this.#graphics.execute(statement, this.#evaluator, this.#host);
          break;
        case 'ClsStatement':
          this.#callHost('clear', line);
          break;
        case 'RemStatement':
        case 'DimStatement':
          break;
        case 'EndStatement':
          this.#halt();
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
