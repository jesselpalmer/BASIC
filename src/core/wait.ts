import {abortable, abortError, isAbortError} from './cancellation.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import type {Evaluator} from './evaluator.ts';
import type {Host, NodeOf} from './types.ts';

/** Validate once before requesting any timer; the caller guards synchronous host effects. */
export async function waitFor(
  host: Pick<Host, 'wait'>,
  evaluator: Evaluator,
  statement: NodeOf<'WaitStatement'>,
  signal: AbortSignal,
): Promise<void> {
  const duration = evaluator.evaluate(statement.duration);
  const location = statement.duration.location;
  if (typeof duration !== 'number') {
    throw new BasicRuntimeError(
      'TYPE_MISMATCH',
      'WAIT duration must be numeric',
      location.start,
      location.label,
    );
  }
  // Reject durations outside the signed 32-bit timer range instead of allowing
  // platform overflow to turn a long wait into a short one. Round up fractions.
  if (duration < 0 || duration > 2_147_483_647) {
    throw new BasicRuntimeError(
      'INVALID_WAIT_DURATION',
      'WAIT duration must be from 0 through 2147483647 milliseconds',
      location.start,
      location.label,
    );
  }
  const milliseconds = duration === 0 ? 0 : Math.ceil(duration);
  try {
    await abortable(() => host.wait(milliseconds, {signal}), signal, 'Host wait failed');
  } catch (cause) {
    if (signal.aborted || isAbortError(cause)) throw abortError();
    throw new BasicRuntimeError(
      'WAIT_FAILED',
      'Host wait failed',
      statement.location.start,
      statement.location.label,
      {cause},
    );
  }
}
