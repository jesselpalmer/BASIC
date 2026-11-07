import {abortable, abortError, isAbortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {injectMa2Value, type Ma2Value} from './ma2_value.ts';
import type {Host, NodeOf} from './types.ts';

type Result =
  | Readonly<{kind: 'value'; target: string; value: Ma2Value | string}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'target' | 'numeric-response' | 'string-response';
    }>;

/** Read one selected 1CHECK response; the caller owns committing it and retry policy. */
export async function readSelectedMa2Input(
  host: Pick<Host, 'readLine'>,
  statement: NodeOf<'InputStatement'>,
  signal: AbortSignal,
): Promise<Result> {
  const target = statement.target.name;
  if (target !== 'F' && target !== 'T' && target !== 'A$')
    return Object.freeze({kind: 'unsupported', reason: 'target'});

  let text: string | null;
  try {
    // Pass the literal prompt without guessing terminal punctuation/spacing.
    text = await abortable(
      () => host.readLine(statement.prompt?.value ?? '', {signal}),
      signal,
      'Selected MA2 input failed',
    );
  } catch (cause) {
    if (signal.aborted || isAbortError(cause)) throw abortError();
    throw new BasicRuntimeError(
      'INPUT_FAILED',
      'Selected MA2 input source failed',
      statement.location.start,
      statement.location.label,
      {cause},
    );
  }
  if (signal.aborted) throw abortError();
  if (text === null)
    throw new BasicRuntimeError(
      'INPUT_ENDED',
      'Selected MA2 input ended',
      statement.location.start,
      statement.location.label,
    );
  if (typeof text !== 'string')
    throw new BasicRuntimeError(
      'INPUT_FAILED',
      'Selected MA2 input must return text or null',
      statement.location.start,
      statement.location.label,
    );

  if (target === 'A$') {
    if (text.length > 255 || /[^\x20-\x7e]/.test(text))
      return Object.freeze({kind: 'unsupported', reason: 'string-response'});
    return Object.freeze({kind: 'value', target, value: text});
  }
  // This is only the first game's exact unsigned square-number response path.
  // General historical numeric INPUT spelling/retry rules remain unresolved.
  if (!/^(?:0|[1-9][0-9]?)$/.test(text) || Number(text) > 64)
    return Object.freeze({kind: 'unsupported', reason: 'numeric-response'});
  // Every integer in 0..64 is exactly representable in selected MA2 words.
  const injected = injectMa2Value(Number(text)) as {kind: 'value'; value: Ma2Value};
  return Object.freeze({kind: 'value', target, value: injected.value});
}
