import {abortable, abortError} from './cancellation.ts';
import type {ExecutionScheduler, InputOptions} from './types.ts';

// A task boundary (rather than a resolved Promise) lets timers, signals, and
// browser events run. Cancellation removes the timer instead of keeping a handle.
export function defaultWait(milliseconds: number, {signal}: InputOptions = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) onAbort();
  });
}

export const defaultScheduler: ExecutionScheduler = (signal) => defaultWait(0, {signal});

export function yieldExecution(scheduler: ExecutionScheduler, signal: AbortSignal): Promise<void> {
  return abortable(() => scheduler(signal), signal, 'Execution scheduler failed');
}
