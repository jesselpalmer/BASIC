import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import {expressionType} from './comparison.ts';
import type {BasicValue, Location, NodeOf} from './types.ts';

export const maxDispatchTargets = 4096;

/** Bound and validate the complete list, including destinations never selected. */
export function validateDispatch(statement: NodeOf<'OnStatement'>): void {
  const fail = (code: string, message: string, location: Location = statement.location): never => {
    throw new BasicSyntaxError(code, message, location.start, location.label);
  };
  if (
    (statement.transfer !== 'goto' && statement.transfer !== 'gosub') ||
    !Array.isArray(statement.targets) ||
    statement.targets.length === 0 ||
    !statement.selector
  )
    fail('INVALID_DISPATCH', 'Expected an ON selector, GOTO/GOSUB and nonempty target list');
  if (statement.targets.length > maxDispatchTargets)
    fail('DISPATCH_LIMIT', `ON permits at most ${maxDispatchTargets} targets`);
  for (const target of statement.targets) {
    if (
      !target ||
      target.type !== 'NumberLiteral' ||
      !Number.isSafeInteger(target.value) ||
      target.value < 1 ||
      target.value > 65535 ||
      typeof target.raw !== 'string' ||
      !/^\d+$/.test(target.raw) ||
      Number(target.raw) !== target.value
    )
      fail('INVALID_TARGET', 'Expected a literal label from 1 through 65535', target?.location);
  }
  if (expressionType(statement.selector) === 'string')
    fail('TYPE_MISMATCH', 'ON selector must be numeric', statement.selector.location);
}

/** Selector evaluation belongs to the runtime; selecting a literal has no effects. */
export function dispatchTarget(
  statement: NodeOf<'OnStatement'>,
  value: BasicValue,
): NodeOf<'NumberLiteral'> {
  const {location} = statement.selector;
  if (typeof value !== 'number')
    throw new BasicRuntimeError(
      'TYPE_MISMATCH',
      'ON selector must be numeric',
      location.start,
      location.label,
    );
  const index = Math.trunc(value);
  if (!Number.isFinite(index) || index < 1 || index > statement.targets.length)
    throw new BasicRuntimeError(
      'DISPATCH_RANGE',
      `ON selector must truncate to 1 through ${statement.targets.length}`,
      location.start,
      location.label,
    );
  return statement.targets[index - 1];
}
