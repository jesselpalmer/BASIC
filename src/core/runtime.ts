import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {abortable, abortError, isAbortError} from './cancellation.ts';
import {ControlFlow} from './control_flow.ts';
import {createAltairEvaluator, createEduSystem30Evaluator, Evaluator} from './evaluator.ts';
import {EduSystem30Terminal} from './edusystem30_terminal.ts';
import {AltairTerminal} from './altair_terminal.ts';
import {DataReader} from './data.ts';
import {GraphicsState} from './graphics.ts';
import {createHost} from './host.ts';
import {validateDialect} from './dialect.ts';
import {readInput, inputTargets, isInputStatement} from './input.ts';
import type {InputStatement} from './input.ts';
import {waitFor} from './wait.ts';
import {
  isInternalSelectedProgram,
  prepareInternalSelectedProgram,
  prepareProgram,
} from './prepared_program.ts';
import {prepareSelectedMa2Driver} from './ma2_state_program.ts';
import {
  createNativeStatementPolicy,
  type StatementExecutionPolicy,
} from './native_statement_policy.ts';
import {programInstructions} from './instructions.ts';
import type {Instruction} from './instructions.ts';
import type {
  InternalSelectedProgram,
  PreparedMa2Candidate,
  PreparedProgram,
} from './prepared_program.ts';
import {defaultScheduler, yieldExecution} from './scheduling.ts';
import {parseLine} from '../parser/parser.ts';
import {validateBasicPlusMa2Candidate} from '../parser/ma2_candidate_validation.ts';
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

const internalSelectedToken = Symbol('internal-selected-ma2');

/** Internal selected experiment with private Program transport. */
export function createInternalSelectedBasic(
  program: string | InternalSelectedProgram,
  host: Partial<Host> = {},
): Basic {
  return new Basic(host, {}, {token: internalSelectedToken, program});
}

export default class Basic {
  readonly #internalSelected: boolean;
  readonly #privateSelected: boolean;
  readonly #dialect: Dialect;
  readonly #emptyProgram: PreparedProgram;
  readonly #host: Host;
  readonly #evaluator: Evaluator;
  readonly #graphics = new GraphicsState();
  readonly #altair: AltairTerminal | null;
  readonly #eduSystem30:
    (ReturnType<typeof createEduSystem30Evaluator> & {terminal: EduSystem30Terminal}) | null;
  #statementPolicy: StatementExecutionPolicy;
  #prepared: PreparedProgram | PreparedMa2Candidate;
  #selectedDriver: ReturnType<typeof prepareSelectedMa2Driver> | null = null;
  #selectedProgram: InternalSelectedProgram | null = null;
  #privateSelectedSteps = 0;
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

  constructor(
    host: Partial<Host> = {},
    options: LanguageOptions = {},
    internal?: {readonly token: symbol; readonly program: string | InternalSelectedProgram},
  ) {
    if (internal && internal.token !== internalSelectedToken)
      throw new TypeError('Unsupported internal execution context');
    this.#privateSelected = internal !== undefined;
    this.#dialect = validateDialect(options.dialect);
    this.#internalSelected = internal !== undefined || this.#dialect === 'basic-plus-v4a12-ma2';
    this.#altair = this.#dialect === 'altair-8k-4.0' ? new AltairTerminal() : null;
    this.#emptyProgram = prepareProgram('', this.#internalSelected ? 'native' : this.#dialect);
    this.#prepared = this.#emptyProgram;
    this.#host = Object.freeze(createHost(host));
    this.#eduSystem30 =
      this.#dialect === 'edusystem-30'
        ? {...createEduSystem30Evaluator(this.#host), terminal: new EduSystem30Terminal()}
        : null;
    const eduSystem30 = this.#eduSystem30;
    this.#evaluator =
      eduSystem30?.evaluator ??
      (this.#altair ? createAltairEvaluator(this.#host) : new Evaluator(this.#host));
    this.#controlFlow = this.#createControlFlow(this.#prepared);
    this.#data = new DataReader(this.#prepared.dataItems);
    this.#statementPolicy = createNativeStatementPolicy({
      evaluator: this.#evaluator,
      data: () => this.#data,
      graphics: this.#graphics,
      formatPrint: eduSystem30
        ? (statement) =>
            eduSystem30.terminal.print(statement, (expression) =>
              eduSystem30.evaluator.evaluateNumber(expression),
            )
        : undefined,
      assignExpression: eduSystem30
        ? (target, expression) =>
            eduSystem30.evaluator.assignNumber(
              target,
              eduSystem30.evaluator.evaluateNumber(expression),
            )
        : undefined,
      randomize: eduSystem30?.randomize,
      fallThroughIfFalse: eduSystem30 !== null,
    });
    if (internal) {
      if (typeof internal.program === 'string') this.reset(internal.program);
      else this.resetInternalSelectedProgram(internal.program);
    }
  }

  get host(): Readonly<Host> {
    return this.#host;
  }

  get dialect(): Dialect {
    if (this.#privateSelected)
      throw new TypeError('Internal selected MA2 execution has no public dialect');
    return this.#dialect;
  }

  get status(): RunStatus {
    return this.#status;
  }

  get variables(): readonly VariableSnapshot[] {
    if (this.#selectedDriver) return this.#selectedDriver.variables();
    return this.#evaluator.snapshotVariables();
  }

  get arrays(): readonly ArraySnapshot[] {
    if (this.#selectedDriver) return this.#selectedDriver.arrays();
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
    if (this.#internalSelected) {
      return this.#resetSelected(program);
    }
    this.#assertIdle();
    this.#invalidateExecution();
    this.#evaluator.reset();
    this.#graphics.reset();
    this.#altair?.reset();
    this.#eduSystem30?.terminal.reset();
    this.#status = 'ready';
    this.#current = null;
    this.#diagnostic = null;
    this.#immediate = false;
    this.#usedLabels.clear();
    try {
      // A failed candidate leaves both the previous snapshot and its tables intact.
      const candidate: PreparedProgram =
        program === undefined
          ? (this.#prepared as PreparedProgram)
          : prepareProgram(program, this.#dialect);
      this.#startSharedRun(candidate);
    } catch (error) {
      this.#recordFailure(error);
      throw error;
    }
    return this.state;
  }

  #startSharedRun(candidate: PreparedProgram): void {
    this.#evaluator.reset(candidate.arrayDeclarations);
    this.#prepared = candidate;
    this.#controlFlow = this.#createControlFlow(candidate);
    this.#data = new DataReader(candidate.dataItems);
  }

  #createControlFlow(prepared: PreparedProgram): ControlFlow {
    return new ControlFlow(
      prepared,
      this.#evaluator,
      this.#eduSystem30 ? 'selected-edu30' : 'native',
    );
  }

  /** Internal source-bound Program replacement through the same Basic driver. */
  resetInternalSelectedProgram(program: InternalSelectedProgram): RunResult {
    if (!this.#privateSelected || !isInternalSelectedProgram(program))
      throw new TypeError('Expected an internal selected Program and execution context');
    return this.#resetSelected(program);
  }

  #resetSelected(program?: string | Program | InternalSelectedProgram): RunResult {
    this.#assertIdle();
    this.#invalidateExecution();
    this.#privateSelectedSteps = 0;
    this.#status = 'ready';
    this.#current = null;
    this.#diagnostic = null;
    try {
      let selected = this.#selectedProgram;
      if (typeof program === 'string') {
        selected = prepareInternalSelectedProgram(program);
      } else if (isInternalSelectedProgram(program)) {
        if (!this.#privateSelected)
          throw new TypeError('Internal selected Program cannot be installed publicly');
        selected = program;
      } else if (program !== undefined) {
        if (this.#privateSelected)
          throw new TypeError('Internal selected execution requires exact source');
        if (program?.type !== 'Program') throw new TypeError('Expected a selected Program');
        validateDialect(program.dialect, this.#dialect);
        const {source, lines} = program;
        if (typeof source !== 'string')
          throw new TypeError('Historical Program requires exact source');
        if (!Array.isArray(lines)) throw new TypeError('Expected an array of parsed lines');
        validateBasicPlusMa2Candidate(source, lines, this.#dialect);
        selected = prepareInternalSelectedProgram(source);
      }
      if (selected === null) throw new TypeError('Missing selected source');
      const driver = prepareSelectedMa2Driver(
        selected.source,
        (text) => this.#callHost('write', this.#current!, text),
        selected.lines,
      );
      this.#selectedProgram = selected;
      this.#selectedDriver = driver;
      this.#prepared = driver.prepared;
      this.#controlFlow = driver.flow;
      this.#statementPolicy = {
        execute: (line, context) => driver.execute(line, context.controlFlow, () => context.halt()),
      };
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
    if (this.#privateSelected && this.#controlFlow.nextInstruction)
      this.#consumePrivateSelectedStep(this.#controlFlow.nextInstruction);
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
    if (this.#privateSelected) this.#consumePrivateSelectedStep(line);
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
    if (this.#dialect !== 'native' || this.#internalSelected)
      throw new TypeError('Selected execution requires a complete source program');
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
      this.#controlFlow = this.#createControlFlow(this.#prepared);
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

  #consumePrivateSelectedStep(line: Instruction): void {
    if (this.#privateSelectedSteps === 10_000) {
      const error = new BasicRuntimeError(
        'INSTRUCTION_LIMIT',
        'Internal selected MA2 instruction limit of 10000 reached',
        line.statement.location.start,
        line.label,
      );
      this.#recordFailure(error);
      throw error;
    }
    this.#privateSelectedSteps++;
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
      } else if (this.#internalSelected) {
        // Whole-source selected admission excludes other suspending forms.
        const selectedStatement = statement as NodeOf<'InputStatement'>;
        const selected = this.#selectedDriver!;
        const result = await selected.readInput(
          {
            readLine: (prompt, options) => {
              this.#executing = true;
              try {
                return this.#host.readLine(prompt, options);
              } finally {
                this.#executing = false;
              }
            },
          },
          selectedStatement,
          controller.signal,
        );
        if (generation !== this.#generation || controller.signal.aborted) throw abortError();
        this.#executing = true;
        try {
          selected.commitInput(selectedStatement, result);
        } finally {
          this.#executing = false;
        }
      } else {
        const host: Pick<Host, 'readLine' | 'write'> = {
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
        };
        const commit = (assign: () => void) => {
          if (generation !== this.#generation || controller.signal.aborted) throw abortError();
          // Indices may invoke host functions. Retain the synchronous guard.
          this.#executing = true;
          try {
            assign();
          } finally {
            this.#executing = false;
          }
        };
        if (this.#altair) {
          await this.#altair.input(host, statement, controller.signal, (target, value) =>
            commit(() => this.#evaluator.assign(target, value)),
          );
        } else if (this.#eduSystem30) {
          const {terminal, evaluator} = this.#eduSystem30;
          const values = await terminal.read(host, statement, controller.signal);
          commit(() =>
            inputTargets(statement).forEach((target, index) =>
              evaluator.assignNumber(target, values[index]),
            ),
          );
        } else {
          const values = await readInput(host, statement, controller.signal);
          commit(() =>
            inputTargets(statement).forEach((target, index) =>
              this.#evaluator.assign(target, values[index]),
            ),
          );
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
      if (this.#altair && statement.type === 'PrintStatement') {
        this.#altair.print(statement, this.#evaluator, (text) =>
          this.#callHost('write', line, text),
        );
      } else {
        this.#statementPolicy.execute(line, {
          controlFlow: this.#controlFlow,
          host: this.#host,
          callHost: (callback, instruction, text) => this.#callHost(callback, instruction, text),
          halt: () => this.#halt(),
          // Restart inside the current driver, retaining its cancellation,
          // debugger gate, instruction budget and terminal column.
          restart: () => this.#startSharedRun(this.#prepared as PreparedProgram),
        });
      }
      if (
        !this.#immediate &&
        statement.type !== 'EndStatement' &&
        statement.type !== 'StopStatement' &&
        statement.type !== 'RunStatement'
      )
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
