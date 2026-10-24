import Basic from '../core/runtime.ts';
import {abortError, isAbortError} from '../core/cancellation.ts';
import {defaultScheduler} from '../core/scheduling.ts';
import type {
  Diagnostic,
  ExecutionScheduler,
  GraphicsCommand,
  Location,
  VariableSnapshot,
} from '../core/types.ts';

export type BrowserStatus =
  'idle' | 'running' | 'waiting' | 'paused' | 'stopped' | 'finished' | 'error';

export interface BrowserState {
  readonly status: BrowserStatus;
  /** True while execution is gated, including a single step awaiting INPUT. */
  readonly isPaused: boolean;
  /** The exact source snapshot used by this run, independent of editor changes. */
  readonly source: string;
  readonly diagnostic: Readonly<Diagnostic> | null;
  readonly currentLocation: Location | null;
  readonly nextLocation: Location | null;
  readonly variables: readonly VariableSnapshot[];
}

export interface BrowserView {
  write(text: string): void;
  clear(): void;
  draw?(command: GraphicsCommand): void;
  /** Keep this bound submit callback with the displayed prompt; stale calls return false. */
  requestInput(prompt: string, submit: (text: string) => boolean): void;
  stateChanged(state: BrowserState): void;
}

export interface BrowserSessionOptions {
  random?: () => number;
  scheduler?: ExecutionScheduler;
  yieldEvery?: number;
}

export interface BrowserRunOptions {
  /** Prepare and inspect the first statement before executing it. */
  paused?: boolean;
}

interface Execution {
  basic: Basic;
  state: BrowserState;
  callbackFailure: {error: unknown} | null;
  paused: boolean;
  stepPending: boolean;
  stepActive: boolean;
  release: (() => void) | null;
}

interface PendingInput {
  submit: (text: string) => boolean;
}

/** A portable host for the shared interpreter; it owns runs and outstanding input. */
export class BrowserSession {
  readonly #view: BrowserView;
  readonly #options: BrowserSessionOptions;
  #state: BrowserState = Object.freeze({
    status: 'idle',
    isPaused: false,
    source: '',
    diagnostic: null,
    currentLocation: null,
    nextLocation: null,
    variables: Object.freeze([]),
  });
  #execution: Execution | null = null;
  #pending: PendingInput | null = null;
  #callbackDepth = 0;

  constructor(view: BrowserView, options: BrowserSessionOptions = {}) {
    this.#view = view;
    this.#options = {...options};
  }

  get state(): BrowserState {
    return this.#state;
  }

  async run(source: string, options: BrowserRunOptions = {}): Promise<BrowserState> {
    this.#assertOutsideCallback();
    const {yieldEvery = 256, scheduler = defaultScheduler} = this.#options;
    let optionError: TypeError | null = null;
    if (!Number.isSafeInteger(yieldEvery) || yieldEvery < 1)
      optionError = new TypeError('yieldEvery must be a positive safe integer');
    else if (typeof scheduler !== 'function')
      optionError = new TypeError('scheduler must be a function');
    if (optionError) {
      if (!this.#execution) this.#state = Object.freeze({...this.#state, status: 'error', source});
      throw optionError;
    }
    this.stop();
    const draw = this.#view.draw?.bind(this.#view);
    const execution: Execution = {
      basic: new Basic({
        write: (text) => this.#callView(execution, () => this.#view.write(text)),
        clear: () => this.#callView(execution, () => this.#view.clear()),
        readLine: (prompt = '', {signal} = {}) => this.#readLine(execution, prompt, signal!),
        random: this.#options.random,
        draw: draw ? (command) => this.#callView(execution, () => draw(command)) : undefined,
      }),
      state: Object.freeze({
        status: 'running',
        isPaused: false,
        source,
        diagnostic: null,
        currentLocation: null,
        nextLocation: null,
        variables: Object.freeze([]),
      }),
      callbackFailure: null,
      paused: options.paused ?? false,
      stepPending: false,
      stepActive: false,
      release: null,
    };
    this.#execution = execution;
    try {
      this.#publish(execution, 'running');
      this.#callView(execution, () => this.#view.clear());
      await execution.basic.runAsync(source, {
        scheduler: (signal) => {
          this.#publish(execution, execution.paused ? 'paused' : 'running');
          return scheduler(signal);
        },
        yieldEvery,
        beforeStatement: () => this.#checkpoint(execution),
      });
      if (this.#execution !== execution || execution.state.status === 'stopped')
        return execution.state;
      this.#publish(execution, 'finished');
    } catch (error) {
      if (execution.callbackFailure) {
        execution.basic.cancel();
        this.#publishSilently(execution, 'error');
        throw execution.callbackFailure.error;
      }
      if (this.#execution !== execution || isAbortError(error)) return execution.state;
      const diagnostic = execution.basic.state.diagnostic;
      if (!diagnostic) {
        execution.basic.cancel();
        this.#publishSilently(execution, 'error');
        throw error;
      }
      this.#publish(execution, 'error', diagnostic);
    }
    return execution.state;
  }

  stop(): BrowserState {
    this.#assertOutsideCallback();
    const execution = this.#execution;
    if (
      execution &&
      (this.#state.status === 'running' ||
        this.#state.status === 'waiting' ||
        this.#state.status === 'paused')
    ) {
      execution.basic.cancel();
      this.#publish(execution, 'stopped');
    }
    return this.#state;
  }

  /** Pause at the next statement boundary without cancelling input or loop state. */
  pause(): BrowserState {
    this.#assertOutsideCallback();
    const execution = this.#execution;
    if (execution && (this.#state.status === 'running' || this.#state.status === 'waiting')) {
      execution.paused = true;
      execution.stepPending = false;
      execution.stepActive = false;
      this.#publishControl(execution, this.#pending ? 'waiting' : 'paused');
    }
    return this.#state;
  }

  resume(): BrowserState {
    this.#assertOutsideCallback();
    const execution = this.#execution;
    if (
      execution &&
      this.#state.isPaused &&
      this.#state.status !== 'finished' &&
      this.#state.status !== 'stopped' &&
      this.#state.status !== 'error'
    ) {
      execution.paused = false;
      execution.stepPending = false;
      this.#publishControl(execution, this.#pending ? 'waiting' : 'running');
      execution.release?.();
    }
    return this.#state;
  }

  /** Execute one statement; INPUT completes only after a valid answer arrives. */
  step(): BrowserState {
    this.#assertOutsideCallback();
    const execution = this.#execution;
    if (execution && this.#state.status === 'paused') {
      execution.stepPending = execution.basic.status !== 'waiting';
      execution.stepActive = true;
      this.#publishControl(execution, this.#pending ? 'waiting' : 'running');
      execution.release?.();
    }
    return this.#state;
  }

  #checkpoint(execution: Execution): void | Promise<void> {
    if (
      this.#execution !== execution ||
      execution.state.status === 'stopped' ||
      execution.callbackFailure
    )
      return;
    execution.stepActive = false;
    if (!execution.paused) return;
    if (execution.stepPending) {
      execution.stepPending = false;
      execution.stepActive = true;
      return;
    }
    this.#publish(execution, 'paused');
    return new Promise<void>((resolve) => {
      execution.release = () => {
        execution.release = null;
        resolve();
      };
    }).then(() => this.#checkpoint(execution));
  }

  /** Submit to the currently displayed request; prefer the bound callback for DOM events. */
  submitInput(text: string): boolean {
    return this.#pending?.submit(text) ?? false;
  }

  #readLine(execution: Execution, prompt: string, signal: AbortSignal): Promise<string> {
    let resolveInput!: (text: string) => void;
    let rejectInput!: (error: unknown) => void;
    const input = new Promise<string>((resolve, reject) => {
      resolveInput = resolve;
      rejectInput = reject;
    });
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
      if (this.#pending === pending) this.#pending = null;
    };
    const onAbort = () => {
      cleanup();
      rejectInput(abortError());
    };
    const pending: PendingInput = {
      submit: (text) => {
        if (this.#pending !== pending || this.#execution !== execution) return false;
        cleanup();
        try {
          this.#publish(
            execution,
            execution.paused && !execution.stepActive ? 'paused' : 'running',
          );
          resolveInput(text);
        } catch (error) {
          rejectInput(error);
          throw error;
        }
        return true;
      },
    };
    this.#pending = pending;
    signal.addEventListener('abort', onAbort, {once: true});
    // Attach a rejection consumer before invoking user code, which can throw or submit.
    void input.catch(() => {});
    try {
      this.#publish(execution, 'waiting');
      this.#callView(execution, () => this.#view.requestInput(prompt, pending.submit));
    } catch (error) {
      cleanup();
      rejectInput(error);
      throw error;
    }
    return input;
  }

  #publishControl(execution: Execution, status: BrowserStatus): void {
    try {
      this.#publish(execution, status);
    } catch (error) {
      execution.basic.cancel();
      throw error;
    }
  }

  #publish(
    execution: Execution,
    status: BrowserStatus,
    diagnostic: Readonly<Diagnostic> | null = null,
  ): void {
    this.#publishSilently(execution, status, diagnostic);
    if (this.#execution === execution)
      this.#callView(execution, () => this.#view.stateChanged(execution.state));
  }

  #publishSilently(
    execution: Execution,
    status: BrowserStatus,
    diagnostic: Readonly<Diagnostic> | null = null,
  ): void {
    const state = execution.basic.state;
    execution.state = Object.freeze({
      status,
      isPaused:
        execution.paused && (status === 'paused' || status === 'running' || status === 'waiting'),
      source: execution.state.source,
      diagnostic,
      currentLocation: state.currentLocation,
      nextLocation: state.nextLocation,
      variables: execution.basic.variables,
    });
    if (this.#execution === execution) this.#state = execution.state;
  }

  #callView(execution: Execution, callback: () => void): void {
    this.#callbackDepth++;
    try {
      callback();
    } catch (error) {
      execution.callbackFailure = {error};
      throw error;
    } finally {
      this.#callbackDepth--;
    }
  }

  #assertOutsideCallback(): void {
    if (this.#callbackDepth)
      throw new Error('Cannot control execution during a browser view callback');
  }
}
