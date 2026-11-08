import {BasicSyntaxError} from '../core/diagnostic.ts';
import type {Expression, NodeOf, ParsedLine} from '../core/types.ts';

function unsupported(node: {location: ParsedLine['location']}, detail: string): never {
  throw new BasicSyntaxError(
    'UNSUPPORTED_EDUSYSTEM30_FORM',
    `EDUSYSTEM-30 supports only ${detail} in this profile`,
    node.location.start,
    node.location.label,
  );
}

function validateScalar(node: Expression): void {
  if (node.type !== 'Variable' || !/^[A-Z]$/.test(node.name))
    unsupported(node, 'single-letter numeric scalars');
}

function validateNumber(expression: Expression): void {
  const pending = [expression];
  while (pending.length) {
    const node = pending.pop()!;
    // Every expression outside the allowlist is unsupported.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (node.type) {
      case 'Variable':
        validateScalar(node);
        break;
      case 'NumberLiteral':
        if (!/^\d{1,4}$/.test(node.raw)) unsupported(node, 'small unsigned integer literals');
        break;
      case 'GroupExpression':
        pending.push(node.expression);
        break;
      case 'BinaryExpression':
        if (!['+', '-', '*', '/'].includes(node.operator)) unsupported(node, '+, -, * and /');
        pending.push(node.right, node.left);
        break;
      case 'CallExpression':
        if (node.name === 'INT' && node.arguments.length === 1) {
          pending.push(node.arguments[0]);
        } else if (
          node.name !== 'RND' ||
          node.arguments.length !== 1 ||
          node.arguments[0].type !== 'NumberLiteral' ||
          node.arguments[0].raw !== '0'
        ) {
          unsupported(node, 'INT(expression) and RND(0)');
        }
        break;
      default:
        unsupported(node, 'the numeric expressions used by 23MTCH');
    }
  }
}

function validatePrint(statement: NodeOf<'PrintStatement'>): void {
  const {items, separators, trailingSemicolon} = statement;
  if (items.length && separators.length !== items.length - (trailingSemicolon ? 0 : 1))
    unsupported(statement, 'semicolon-separated PRINT items');
  for (const item of items) {
    if (item.type !== 'StringLiteral') validateScalar(item);
  }
}

/** The reviewed game uses one statement per line and only this closed subset. */
export function validateEduSystem30Line({statement}: ParsedLine): void {
  // Every statement outside the allowlist is unsupported.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (statement.type) {
    case 'RemStatement':
    case 'EndStatement':
    case 'GotoStatement':
      return;
    case 'LetStatement':
      validateScalar(statement.target);
      validateNumber(statement.expression);
      return;
    case 'IfStatement':
      validateNumber(statement.condition.left);
      validateNumber(statement.condition.right);
      return;
    case 'InputStatement':
      if (statement.prompt) unsupported(statement.prompt, 'unprompted numeric scalar INPUT');
      validateScalar(statement.target);
      return;
    case 'PrintStatement':
      validatePrint(statement);
      return;
    default:
      unsupported(statement, 'REM, LET, IF with a line target, GO TO, INPUT, PRINT and END');
  }
}
