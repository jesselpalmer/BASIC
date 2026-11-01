import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {abortable, abortError, isAbortError} from './cancellation.ts';
import {ControlFlow} from './control_flow.ts';
import {dispatchTarget} from './dispatch.ts';
import {Evaluator} from './evaluator.ts';
import {DataReader} from './data.ts';
import {GraphicsState} from './graphics.ts';
import {createHost} from './host.ts';
import {validateDialect} from './dialect.ts';
import {readInput, inputTargets, isInputStatement} from './input.ts';
import type {InputStatement} from './input.ts';
import {formatPrintUsing} from './print_using.ts';
import {waitFor} from './wait.ts';
import {prepareProgram} from './prepared_program.ts';
import {programInstructions} from './instructions.ts';
import type {Instruction} from './instructions.ts';
import type {PreparedProgram} from './prepared_program.ts';
import {defaultScheduler, yieldExecution} from './scheduling.ts';
import {parseLine} from '../parser/parser.ts';
import type {
  Diagnostic,
  Dialect,
  LanguageOptions,
  Host,
  InputOptions,
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
  #data: DataReader;
  #status: RunStatus = 'ready';
  #current: Instruction | null = null;
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
    this.#data = new DataReader(this.#prepared.dataItems);
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
          ? (this.#controlFlow.nextInstruction?.statement.location ?? null)
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
      this.#data = new DataReader(this.#prepared.dataItems);
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
        const line = this.#controlFlow.nextInstruction;
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
            const next = this.#controlFlow.nextInstruction!;
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
    const line = this.#controlFlow.takeInstruction();
    if (!line) {
      this.#halt();
      return this.state;
    }
    this.#execute(line);
    if (!this.#controlFlow.nextInstruction) {
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
    const line = this.#controlFlow.nextInstruction;
    if (
      !line ||
      this.#immediate ||
      (!isInputStatement(line.statement) && line.statement.type !== 'WaitStatement')
    )
      return this.#step();
    const generation = this.#generation;
    this.#controlFlow.takeInstruction();
    await this.#executeSuspension(line, line.statement, signal);
    if (generation !== this.#generation) throw abortError();
    this.#checkAbort(signal);
    this.#status = 'running';
    if (!this.#controlFlow.nextInstruction) {
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
    if (line && (isInputStatement(line.statement) || line.statement.type === 'WaitStatement')) {
      await this.#executeSuspension(line, line.statement, options.signal);
      if (generation !== this.#generation) throw abortError();
      this.#checkAbort(options.signal);
      this.#status = 'running';
    } else if (line) this.#execute(line);
    if (generation !== this.#generation) throw abortError();
    return this.state;
  }

  #prepareImmediate(source: string, options: SourceOptions): Instruction | null {
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
      if (line.statement.type === 'StatementSequence') {
        throw new BasicRuntimeError(
          'PROGRAM_REQUIRED',
          'Statement sequences require a complete program; use run or runAsync',
          line.statement.location.start,
          line.label,
        );
      }
      if (
        isInputStatement(line.statement) &&
        inputTargets(line.statement).some((target) => target.type === 'ArrayReference')
      )
        throw new BasicRuntimeError(
          'PROGRAM_REQUIRED',
          'Indexed INPUT requires a complete program; use runAsync or stepAsync',
          line.statement.location.start,
          line.label,
        );
      this.#usedLabels.add(line.label);
      this.#prepared = this.#emptyProgram;
      this.#controlFlow = new ControlFlow(this.#prepared, this.#evaluator);
      this.#immediate = true;
      return programInstructions([line])[0];
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
    line: Instruction,
    statement: InputStatement | NodeOf<'WaitStatement'>,
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
        const values = await readInput(
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
        // Indices may invoke host functions. Keep the same mutation guard as
        // synchronous assignment while committing the validated response.
        this.#executing = true;
        try {
          inputTargets(statement).forEach((target, index) =>
            this.#evaluator.assign(target, values[index]),
          );
        } finally {
          this.#executing = false;
        }
      }
      if (generation !== this.#generation || controller.signal.aborted) throw abortError();
      if (!this.#immediate) this.#controlFlow.finishInstruction();
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
    this.#controlFlow.clearFrames();
    this.#status = 'error';
    this.#diagnostic =
      error instanceof BasicRuntimeError || error instanceof BasicSyntaxError
        ? Object.freeze({...error.diagnostic})
        : null;
  }

  #halt(): void {
    this.#controlFlow.clearFrames();
    this.#status = 'halted';
  }

  #execute(line: Instruction): void {
    this.#current = line;
    this.#status = 'running';
    this.#executing = true;
    const statement = line.statement;
    try {
      if (
        this.#immediate &&
        (statement.type === 'DimStatement' ||
          statement.type === 'ChangeStatement' ||
          statement.type === 'DataStatement' ||
          statement.type === 'ReadStatement' ||
          statement.type === 'RestoreStatement' ||
          statement.type === 'IfStatement' ||
          statement.type === 'InlineIfStatement' ||
          statement.type === 'GotoStatement' ||
          statement.type === 'GosubStatement' ||
          statement.type === 'OnStatement' ||
          statement.type === 'ReturnStatement' ||
          statement.type === 'ForStatement' ||
          statement.type === 'NextStatement')
      ) {
        throw new BasicRuntimeError(
          'PROGRAM_REQUIRED',
          'DIM, CHANGE, DATA, READ, RESTORE, IF, GOTO, GOSUB, ON, RETURN, FOR, and NEXT require a complete program; use run or runAsync',
          statement.location.start,
          line.label,
        );
      }
      switch (statement.type) {
        case 'ChangeStatement':
          this.#evaluator.change(statement);
          break;
        case 'ReadStatement':
          this.#data.read(statement, this.#evaluator);
          break;
        case 'RestoreStatement':
          this.#data.restore();
          break;
        case 'ForStatement':
          this.#controlFlow.beginLoop(statement);
          break;
        case 'NextStatement':
          this.#controlFlow.nextLoop(statement);
          break;
        case 'GotoStatement':
          this.#controlFlow.jump(statement.target.value, statement.target.location);
          break;
        case 'GosubStatement':
          this.#controlFlow.call(statement.target, statement.location);
          break;
        case 'OnStatement': {
          const target = dispatchTarget(statement, this.#evaluator.evaluate(statement.selector));
          if (statement.transfer === 'goto') this.#controlFlow.jump(target.value, target.location);
          else this.#controlFlow.call(target, statement.location);
          break;
        }
        case 'ReturnStatement':
          this.#controlFlow.returnFromCall(statement.location);
          break;
        case 'IfStatement':
          if (this.#evaluator.compare(statement.condition))
            this.#controlFlow.jump(statement.target.value, statement.target.location);
          else this.#controlFlow.skipLine(statement.location);
          break;
        case 'InlineIfStatement':
          this.#controlFlow.chooseBranch(
            this.#evaluator.compare(statement.condition),
            statement.location,
          );
          break;
        case 'WaitStatement':
          throw new BasicRuntimeError(
            'ASYNC_WAIT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for WAIT',
            statement.location.start,
            line.label,
          );
        case 'InputStatement':
        case 'InputTargetsStatement':
        case 'InputLineStatement':
          throw new BasicRuntimeError(
            'ASYNC_INPUT_REQUIRED',
            'Use runAsync, stepAsync, or readLineAsync for INPUT',
            statement.location.start,
            line.label,
          );
        case 'LetStatement':
          this.#evaluator.assign(statement.target, this.#evaluator.evaluate(statement.expression));
          break;
        case 'PrintUsingStatement': {
          const format = this.#evaluator.evaluate(statement.format);
          const values = statement.items.map((item) => this.#evaluator.evaluate(item));
          const text = formatPrintUsing(format, values, statement.format.location);
          this.#callHost('write', line, text + (statement.trailingSemicolon ? '' : '\n'));
          break;
        }
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
        case 'DataStatement':
          break;
        case 'EndStatement':
          this.#halt();
          break;
      }
      if (!this.#immediate && statement.type !== 'EndStatement')
        this.#controlFlow.finishInstruction();
    } catch (error) {
      this.#recordFailure(error);
      throw error;
    } finally {
      this.#executing = false;
    }
  }

  #callHost(callback: 'write' | 'clear', line: Instruction, text = ''): void {
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
