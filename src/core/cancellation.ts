/** Cancellation has one identity across input, scheduling, and host adapters. */
export function abortError(): Error {
  const error = new Error('Input cancelled');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Settle independently of an operation that ignores its signal. Both handlers
 * stay attached so a late completion or rejection cannot escape cancellation.
 * The caller supplies the message for non-Error failures and owns translating
 * operation failures into its domain diagnostics.
 */
export function abortable<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  failureMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) {
      onAbort();
      return;
    }
    const failed = (cause: unknown) => {
      cleanup();
      reject(cause instanceof Error ? cause : new Error(failureMessage, {cause}));
    };
    try {
      void Promise.resolve(operation()).then((value) => {
        cleanup();
        resolve(value);
      }, failed);
    } catch (cause) {
      failed(cause);
    }
  });
}
