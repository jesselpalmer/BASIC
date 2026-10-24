import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {Evaluator} from './evaluator.ts';
import {createHost} from './host.ts';
import {abortError, readInput} from './input.ts';
import {containsLoopBody, pairLoops} from './loops.ts';
import type {LoopPair} from './loops.ts';
import {defaultScheduler, yieldExecution} from './scheduling.ts';
import {parseLine, parseProgram, validateProgram} from '../parser/parser.ts';
import type {
  Diagnostic,
  Expression,
  Host,
  InputOptions,
  Location,
  NodeOf,
  ParsedLine,
  Program,
  RunResult,
  RunOptions,
  RunStatus,
  SourceOptions,
} from './types.ts';

const emptyProgram = validateProgram([]);
interface LoopFrame extends LoopPair {
  readonly limit: number;
  readonly step: number;
}

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
  #pendingRun: AbortController | null = null;
  #labelIndices = new Map<number, number>();
  #loopPairs: LoopPair[] = [];
  #pairsByFor = new Map<number, LoopPair>();
  #pairsByNext = new Map<number, LoopPair>();
  #loopFrames = new Map<number, LoopFrame>();

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
    this.#invalidateExecution();
    this.#evaluator.reset();
    this.#loopFrames.clear();
    this.#index = 0;
    this.#status = 'ready';
    this.#current = null;
    this.#diagnostic = null;
    this.#immediate = false;
    this.#usedLabels.clear();
    try {
      if (typeof program === 'string') this.#program = parseProgram(program);
      else if (program !== undefined) this.#program = validateProgram(program.lines);
      this.#labelIndices = new Map(this.#program.lines.map((line, index) => [line.label, index]));
      this.#loopPairs = pairLoops(this.#program.lines);
      this.#pairsByFor = new Map(this.#loopPairs.map((pair) => [pair.forIndex, pair]));
      this.#pairsByNext = new Map(this.#loopPairs.map((pair) => [pair.nextIndex, pair]));
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
    const {signal, instructionLimit, yieldEvery = 256, scheduler = defaultScheduler} = options;
    if (
      instructionLimit !== undefined &&
      (!Number.isSafeInteger(instructionLimit) || instructionLimit < 0)
    )
      throw new TypeError('instructionLimit must be a nonnegative safe integer');
    if (!Number.isSafeInteger(yieldEvery) || yieldEvery < 1)
      throw new TypeError('yieldEvery must be a positive safe integer');
    if (typeof scheduler !== 'function') throw new TypeError('scheduler must be a function');
    this.reset(program);
    const generation = this.#generation;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) controller.abort();
    this.#pendingRun = controller;
    let executed = 0;
    try {
      this.#checkAbort(controller.signal);
      while (this.#status === 'ready' || this.#status === 'running') {
        const line = this.#program.lines[this.#index];
        if (line && executed === instructionLimit) {
          this.#current = line;
          throw new BasicRuntimeError(
            'INSTRUCTION_LIMIT',
            `Instruction limit of ${instructionLimit} reached`,
            line.statement.location.start,
            line.label,
          );
        }
        await this.stepAsync({signal: controller.signal});
        if (generation !== this.#generation) throw abortError();
        this.#checkAbort(controller.signal);
        executed++;
        if (
          (this.#status === 'ready' || this.#status === 'running') &&
          executed % yieldEvery === 0 &&
          executed !== instructionLimit
        ) {
          try {
            await yieldExecution(scheduler, controller.signal);
          } catch (cause) {
            if (generation !== this.#generation || controller.signal.aborted) throw abortError();
            const next = this.#program.lines[this.#index];
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
        if (error instanceof Error && error.name === 'AbortError') this.#halt();
        else this.#recordFailure(error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (this.#pendingRun === controller) this.#pendingRun = null;
    }
  }

  cancel(): RunResult {
    this.#assertIdle();
    if (this.#status === 'halted' || this.#status === 'error') return this.state;
    this.#invalidateExecution();
    this.#halt();
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
      this.#halt();
      return this.state;
    }
    this.#index++;
    this.#execute(line);
    if (this.#index === this.#program.lines.length) {
      this.#halt();
    }
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
    if (this.#index === this.#program.lines.length) {
      this.#halt();
    }
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
      this.#labelIndices.clear();
      this.#loopPairs = [];
      this.#pairsByFor.clear();
      this.#pairsByNext.clear();
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

  #invalidateExecution(): void {
    this.#generation++;
    const pending = this.#pendingInput;
    const run = this.#pendingRun;
    this.#pendingInput = null;
    this.#pendingRun = null;
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
        if (error instanceof Error && error.name === 'AbortError') {
          this.#halt();
        } else this.#recordFailure(error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (this.#pendingInput === controller) this.#pendingInput = null;
    }
  }

  #recordFailure(error: unknown): void {
    this.#loopFrames.clear();
    this.#status = 'error';
    this.#diagnostic =
      error instanceof BasicRuntimeError || error instanceof BasicSyntaxError
        ? Object.freeze({...error.diagnostic})
        : null;
  }

  #halt(): void {
    this.#loopFrames.clear();
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
        (statement.type === 'IfStatement' ||
          statement.type === 'GotoStatement' ||
          statement.type === 'ForStatement' ||
          statement.type === 'NextStatement')
      ) {
        throw new BasicRuntimeError(
          'PROGRAM_REQUIRED',
          'IF, GOTO, FOR, and NEXT require a complete program; use run or runAsync',
          statement.location.start,
          line.label,
        );
      }
      switch (statement.type) {
        case 'ForStatement':
          this.#beginLoop(statement, this.#labelIndices.get(line.label)!);
          break;
        case 'NextStatement':
          this.#nextLoop(statement, this.#labelIndices.get(line.label)!);
          break;
        case 'GotoStatement':
          this.#jump(statement.target.value, statement.target.location);
          break;
        case 'IfStatement':
          if (this.#evaluator.compare(statement.condition))
            this.#jump(statement.target.value, statement.target.location);
          break;
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

  #jump(label: number, location: Location): void {
    const index = this.#labelIndices.get(label);
    if (index === undefined) {
      throw new BasicRuntimeError(
        'MISSING_TARGET',
        `No line label ${label}`,
        location.start,
        location.label,
      );
    }
    this.#moveTo(index, location);
  }

  #moveTo(index: number, location: Location): void {
    for (const pair of this.#loopPairs) {
      if (containsLoopBody(pair, index) && !this.#loopFrames.has(pair.forIndex)) {
        throw new BasicRuntimeError(
          'LOOP_ENTRY',
          `Cannot enter inactive FOR loop for ${pair.variable}`,
          location.start,
          location.label,
        );
      }
    }
    for (const [key, frame] of this.#loopFrames) {
      if (!containsLoopBody(frame, index)) this.#loopFrames.delete(key);
    }
    this.#index = index;
  }

  #loopNumber(expression: Expression): number {
    const value = this.#evaluator.evaluate(expression);
    if (typeof value !== 'number') {
      throw new BasicRuntimeError(
        'TYPE_MISMATCH',
        'Loop values must be numbers',
        expression.location.start,
        expression.location.label,
      );
    }
    return value;
  }

  #beginLoop(statement: NodeOf<'ForStatement'>, index: number): void {
    for (const frame of this.#loopFrames.values()) {
      if (frame.variable === statement.variable.name) {
        throw new BasicRuntimeError(
          'LOOP_VARIABLE_ACTIVE',
          `Loop variable ${frame.variable} is already active`,
          statement.variable.location.start,
          statement.location.label,
        );
      }
    }
    const start = this.#loopNumber(statement.start);
    const limit = this.#loopNumber(statement.end);
    const step = statement.step === null ? 1 : this.#loopNumber(statement.step);
    if (step === 0) {
      throw new BasicRuntimeError(
        'ZERO_STEP',
        'FOR STEP must not be zero',
        statement.step!.location.start,
        statement.location.label,
      );
    }
    this.#evaluator.assign(statement.variable, start);
    const pair = this.#pairsByFor.get(index)!;
    if (step > 0 ? start > limit : start < limit)
      this.#moveTo(pair.nextIndex + 1, statement.location);
    else this.#loopFrames.set(index, {...pair, limit, step});
  }

  #nextLoop(statement: NodeOf<'NextStatement'>, index: number): void {
    const pair = this.#pairsByNext.get(index)!;
    const frame = this.#loopFrames.get(pair.forIndex);
    if (!frame) {
      throw new BasicRuntimeError(
        'LOOP_NOT_ACTIVE',
        `FOR loop for ${pair.variable} is not active`,
        statement.location.start,
        statement.location.label,
      );
    }
    const current = this.#loopNumber(statement.variable);
    const value = current + frame.step;
    if (!Number.isFinite(value)) {
      throw new BasicRuntimeError(
        'NON_FINITE_NUMBER',
        'Loop increment must be finite',
        statement.variable.location.start,
        statement.location.label,
      );
    }
    this.#evaluator.assign(statement.variable, value);
    if (frame.step > 0 ? value <= frame.limit : value >= frame.limit)
      this.#moveTo(frame.forIndex + 1, statement.location);
    else this.#loopFrames.delete(frame.forIndex);
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
