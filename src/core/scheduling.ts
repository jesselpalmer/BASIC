import {abortError} from './input.ts';
import type {ExecutionScheduler} from './types.ts';

// A task boundary (rather than a resolved Promise) lets timers, signals, and
// browser events run. Cancellation removes the timer instead of keeping a handle.
export const defaultScheduler: ExecutionScheduler = (signal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, 0);
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) onAbort();
  });

// A custom scheduler may ignore its signal. Settle independently on abort and
// keep both Promise handlers attached so late completions/rejections are safe.
export function yieldExecution(scheduler: ExecutionScheduler, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const failed = (cause: unknown) => {
      cleanup();
      reject(cause instanceof Error ? cause : new Error('Execution scheduler failed', {cause}));
    };
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      void Promise.resolve(scheduler(signal)).then(() => {
        cleanup();
        resolve();
      }, failed);
    } catch (cause) {
      failed(cause);
    }
  });
}
