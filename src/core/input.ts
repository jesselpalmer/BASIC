import {BasicRuntimeError} from './diagnostic.ts';
import type {BasicValue, Host, NodeOf} from './types.ts';

export function abortError(): Error {
  const error = new Error('Input cancelled');
  error.name = 'AbortError';
  return error;
}

// Settle cancellation independently of a host that might ignore its signal.
// Both promise handlers stay attached, so late rejections are consumed safely.
function abortableRead(
  read: () => Promise<string | null>,
  signal: AbortSignal,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const failed = (cause: unknown) => {
      cleanup();
      reject(cause instanceof Error ? cause : new Error('Input source failed', {cause}));
    };
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      void Promise.resolve(read()).then((value) => {
        cleanup();
        resolve(value);
      }, failed);
    } catch (cause) {
      failed(cause);
    }
  });
}

export async function readInput(
  host: Pick<Host, 'readLine' | 'write'>,
  statement: NodeOf<'InputStatement'>,
  signal: AbortSignal,
): Promise<BasicValue> {
  const prompt = `${statement.prompt?.value ?? ''}? `;
  for (;;) {
    let text: string | null;
    try {
      text = await abortableRead(() => host.readLine(prompt, {signal}), signal);
    } catch (cause) {
      if (signal.aborted || (cause instanceof Error && cause.name === 'AbortError'))
        throw abortError();
      throw new BasicRuntimeError(
        'INPUT_FAILED',
        'Host input failed',
        statement.location.start,
        statement.location.label,
        {cause},
      );
    }
    if (signal.aborted) throw abortError();
    if (text === null) {
      throw new BasicRuntimeError(
        'INPUT_ENDED',
        'Input ended before a value was received',
        statement.location.start,
        statement.location.label,
      );
    }
    if (typeof text !== 'string') {
      throw new BasicRuntimeError(
        'INPUT_FAILED',
        'Host input must return a string or null',
        statement.location.start,
        statement.location.label,
      );
    }
    if (statement.target.name.endsWith('$')) return text;
    const decimal = text.replace(/^[ \t]+|[ \t]+$/g, '');
    const value = Number(decimal);
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal) && Number.isFinite(value)) return value;
    host.write('Invalid number; please enter a finite decimal.\n');
  }
}
