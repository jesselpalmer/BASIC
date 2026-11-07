import {abortable, abortError, isAbortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {basicPlusMa2ReadNumeric} from './basic_plus_ma2_conversion.ts';
import {bindMa2Words, type Ma2Value} from './ma2_value.ts';
import type {Host, NodeOf} from './types.ts';

type Result =
  | Readonly<{kind: 'value'; target: string; value: Ma2Value | string}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'target' | 'numeric-response' | 'numeric-event' | 'string-response' | 'row';
    }>;

/** Read one bounded selected scalar response; the caller owns commit and retry policy. */
export async function readSelectedMa2Input(
  host: Pick<Host, 'readLine'>,
  statement: NodeOf<'InputStatement'>,
  signal: AbortSignal,
): Promise<Result> {
  const target = statement.target.name;
  if (!/^[A-Z][0-9]?\$?$/.test(target))
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

  // Multi-field rows and quoted fields require the historical INPUT scanner.
  if (text.includes(',') || text.includes('"'))
    return Object.freeze({kind: 'unsupported', reason: 'row'});
  if (target.endsWith('$')) {
    if (text.length > 255 || /[^\x20-\x7e]/.test(text))
      return Object.freeze({kind: 'unsupported', reason: 'string-response'});
    return Object.freeze({kind: 'value', target, value: text});
  }
  // Use the bounded complete MA2 decimal conversion facts for one scalar field.
  // INPUT's full scanner, retry and handler behavior are separate evidence gaps.
  if (text.length > 255 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/.test(text))
    return Object.freeze({kind: 'unsupported', reason: 'numeric-response'});
  const converted = basicPlusMa2ReadNumeric(text, 'floating', false);
  if (converted.kind !== 'value' || converted.numericKind !== 'floating')
    return Object.freeze({
      kind: 'unsupported',
      reason:
        converted.kind === 'unsupported' && converted.reason === 'read-numeric-event'
          ? 'numeric-event'
          : 'numeric-response',
    });
  // The conversion helper returns canonical two-word floating values.
  const bound = bindMa2Words(converted.words) as {kind: 'value'; value: Ma2Value};
  return Object.freeze({kind: 'value', target, value: bound.value});
}
