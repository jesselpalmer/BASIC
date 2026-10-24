import Basic from '../core/runtime.ts';
import {abortError, isAbortError} from '../core/cancellation.ts';
import type {Diagnostic, ExecutionScheduler} from '../core/types.ts';

export type BrowserStatus = 'idle' | 'running' | 'waiting' | 'stopped' | 'finished' | 'error';

export interface BrowserState {
  readonly status: BrowserStatus;
  /** The exact source snapshot used by this run, independent of editor changes. */
  readonly source: string;
  readonly diagnostic: Readonly<Diagnostic> | null;
}

export interface BrowserView {
  write(text: string): void;
  clear(): void;
  /** Keep this bound submit callback with the displayed prompt; stale calls return false. */
  requestInput(prompt: string, submit: (text: string) => boolean): void;
  stateChanged(state: BrowserState): void;
}

export interface BrowserSessionOptions {
  random?: () => number;
  scheduler?: ExecutionScheduler;
  yieldEvery?: number;
}

interface Execution {
  basic: Basic;
  state: BrowserState;
  callbackFailure: {error: unknown} | null;
}

interface PendingInput {
  submit: (text: string) => boolean;
}

/** A portable host for the shared interpreter; it owns runs and outstanding input. */
export class BrowserSession {
  readonly #view: BrowserView;
  readonly #options: BrowserSessionOptions;
  #state: BrowserState = Object.freeze({status: 'idle', source: '', diagnostic: null});
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

  async run(source: string): Promise<BrowserState> {
    this.#assertOutsideCallback();
    this.stop();
    const execution: Execution = {
      basic: new Basic({
        write: (text) => this.#callView(execution, () => this.#view.write(text)),
        clear: () => this.#callView(execution, () => this.#view.clear()),
        readLine: (prompt = '', {signal} = {}) => this.#readLine(execution, prompt, signal!),
        random: this.#options.random,
      }),
      state: Object.freeze({status: 'running', source, diagnostic: null}),
      callbackFailure: null,
    };
    this.#execution = execution;
    try {
      this.#publish(execution, 'running');
      this.#callView(execution, () => this.#view.clear());
      await execution.basic.runAsync(source, {
        scheduler: this.#options.scheduler,
        yieldEvery: this.#options.yieldEvery,
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
    if (execution && (this.#state.status === 'running' || this.#state.status === 'waiting')) {
      execution.basic.cancel();
      this.#publish(execution, 'stopped');
    }
    return this.#state;
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
          this.#publish(execution, 'running');
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
    execution.state = Object.freeze({status, source: execution.state.source, diagnostic});
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
    if (this.#callbackDepth) throw new Error('Cannot run or stop during a browser view callback');
  }
}
