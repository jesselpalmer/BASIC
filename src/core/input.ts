import {BasicRuntimeError} from './diagnostic.ts';
import {abortable, abortError, isAbortError} from './cancellation.ts';
import type {BasicValue, Host, NodeOf} from './types.ts';

export async function readInput(
  host: Pick<Host, 'readLine' | 'write'>,
  statement: NodeOf<'InputStatement'>,
  signal: AbortSignal,
): Promise<BasicValue> {
  const prompt = `${statement.prompt?.value ?? ''}? `;
  for (;;) {
    let text: string | null;
    try {
      text = await abortable(() => host.readLine(prompt, {signal}), signal, 'Input source failed');
    } catch (cause) {
      if (signal.aborted || isAbortError(cause)) throw abortError();
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
