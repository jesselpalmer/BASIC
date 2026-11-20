import {abortable, abortError, isAbortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {basicPlusMa2ReadNumeric} from './basic_plus_ma2_conversion.ts';
import {bindMa2Words, type Ma2Value} from './ma2_value.ts';
import {inputTargets, maxInputResponseLength} from './input.ts';
import type {Host, NodeOf} from './types.ts';

export type SelectedMa2InputStatement = NodeOf<'InputStatement'> | NodeOf<'InputTargetsStatement'>;
export type SelectedMa2InputCommit = (index: number, value: Ma2Value) => void;

type Result =
  | Readonly<{kind: 'row'}>
  | Readonly<{kind: 'value'; target: string; value: Ma2Value | string}>
  | Readonly<{
      kind: 'unsupported';
      reason: 'target' | 'numeric-response' | 'numeric-event' | 'string-response' | 'row';
    }>;

/** Scalar results commit after reading; numeric rows use a guarded per-field callback. */
export async function readSelectedMa2Input(
  host: Pick<Host, 'readLine'> & Partial<Pick<Host, 'write'>>,
  statement: SelectedMa2InputStatement,
  signal: AbortSignal,
  commit?: SelectedMa2InputCommit,
): Promise<Result> {
  if (statement.type === 'InputTargetsStatement')
    return readNumericRow(host, statement, signal, commit);
  const target = statement.target.name;
  if (!/^[A-Z][0-9]?\$?$/.test(target))
    return Object.freeze({kind: 'unsupported', reason: 'target'});

  const text = await response(host, statement.prompt?.value ?? '', statement, signal);

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

/** Scalar targets only: source admission checks the same boundary before effects. */
async function readNumericRow(
  host: Pick<Host, 'readLine'> & Partial<Pick<Host, 'write'>>,
  statement: NodeOf<'InputTargetsStatement'>,
  signal: AbortSignal,
  commit?: SelectedMa2InputCommit,
): Promise<Result> {
  const targets = inputTargets(statement);
  if (
    !commit ||
    targets.length === 0 ||
    targets.some((target) => target.type !== 'Variable' || !/^[A-Z][0-9]?$/.test(target.name))
  )
    return Object.freeze({kind: 'unsupported', reason: 'target'});
  let index = 0;
  for (;;) {
    const text = await response(
      host,
      index === 0 ? (statement.prompt?.value ?? '') : '',
      statement,
      signal,
    );
    if (text.length > maxInputResponseLength)
      throw new BasicRuntimeError(
        'INPUT_LIMIT',
        `Selected MA2 INPUT lists permit at most ${maxInputResponseLength} response characters`,
        statement.location.start,
        statement.location.label,
      );
    if (/[^\x20-\x7e]/.test(text)) return Object.freeze({kind: 'unsupported', reason: 'row'});
    const fields = text.split(',');
    for (const field of fields) {
      const raw = field.replace(/^ +| +$/g, '') || '0';
      if (raw.length > 255) return Object.freeze({kind: 'unsupported', reason: 'numeric-response'});
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/.test(raw)) {
        if (!host.write) return Object.freeze({kind: 'unsupported', reason: 'numeric-response'});
        host.write(`ILLEGAL NUMBER at line ${statement.location.label} \n`);
        if (signal.aborted) throw abortError();
        index = 0;
        break;
      }
      const converted = basicPlusMa2ReadNumeric(raw, 'floating', false);
      if (converted.kind !== 'value' || converted.numericKind !== 'floating')
        return Object.freeze({
          kind: 'unsupported',
          reason:
            converted.kind === 'unsupported' && converted.reason === 'read-numeric-event'
              ? 'numeric-event'
              : 'numeric-response',
        });
      const bound = bindMa2Words(converted.words) as {kind: 'value'; value: Ma2Value};
      if (signal.aborted) throw abortError();
      commit(index++, bound.value);
      if (index === targets.length) return Object.freeze({kind: 'row'});
    }
  }
}

async function response(
  host: Pick<Host, 'readLine'>,
  prompt: string,
  statement: SelectedMa2InputStatement,
  signal: AbortSignal,
): Promise<string> {
  let text: string | null;
  try {
    // Pass the literal prompt without guessing terminal punctuation/spacing.
    text = await abortable(
      () => host.readLine(prompt, {signal}),
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

  return text;
}
