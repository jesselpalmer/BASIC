import {BasicSyntaxError} from '../core/diagnostic.ts';
import {lineStatements} from '../core/instructions.ts';
import type {Expression, NodeOf, ParsedLine, SimpleStatement} from '../core/types.ts';

function unsupported(node: {location: ParsedLine['location']}, detail: string): never {
  throw new BasicSyntaxError(
    'UNSUPPORTED_EDUSYSTEM30_FORM',
    `EDUSYSTEM-30 supports only ${detail} in this profile`,
    node.location.start,
    node.location.label,
  );
}

function validateScalar(node: Expression): void {
  if (node.type !== 'Variable' || !/^[A-Z][0-9]?$/.test(node.name))
    unsupported(node, 'numeric scalars named with a letter and optional digit');
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
        if (!/^\d{1,4}$/.test(node.raw) && node.raw !== '.5')
          unsupported(node, 'small unsigned integers and the literal .5');
        break;
      case 'GroupExpression':
        pending.push(node.expression);
        break;
      case 'UnaryExpression':
        if (!['+', '-'].includes(node.operator)) unsupported(node, 'unary + and -');
        pending.push(node.argument);
        break;
      case 'BinaryExpression':
        if (!['+', '-', '*', '/'].includes(node.operator)) unsupported(node, '+, -, * and /');
        pending.push(node.right, node.left);
        break;
      case 'CallExpression':
        if (!['ABS', 'INT', 'RND'].includes(node.name) || node.arguments.length !== 1)
          unsupported(node, 'ABS(expression), INT(expression) and RND(expression)');
        pending.push(node.arguments[0]);
        break;
      default:
        unsupported(node, 'bounded numeric expressions');
    }
  }
}

function validatePrint(statement: NodeOf<'PrintStatement'>): void {
  for (const item of statement.items) {
    if (item.type === 'CallExpression' && item.name === 'TAB' && item.arguments.length === 1) {
      validateNumber(item.arguments[0]);
      continue;
    }
    if (
      item.type === 'CallExpression' &&
      item.name === 'CHR$' &&
      item.arguments.length === 1 &&
      item.arguments[0].type === 'NumberLiteral' &&
      item.arguments[0].raw === '7'
    )
      continue;
    if (item.type !== 'StringLiteral') validateNumber(item);
  }
}

export function validateEduSystem30Line(line: ParsedLine): void {
  for (const statement of lineStatements(line)) validateStatement(statement);
}

function validateStatement(statement: SimpleStatement): void {
  // Every statement outside the allowlist is unsupported.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (statement.type) {
    case 'RemStatement':
    case 'EndStatement':
    case 'StopStatement':
    case 'GotoStatement':
    case 'GosubStatement':
    case 'ReturnStatement':
    case 'RandomizeStatement':
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
      if (statement.prompt) unsupported(statement.prompt, 'unprompted scalar INPUT');
      validateScalar(statement.target);
      return;
    case 'InputTargetsStatement':
      if (statement.prompt || statement.targets.length !== 2)
        unsupported(statement, 'unprompted INPUT with two numeric scalars');
      statement.targets.forEach(validateScalar);
      return;
    case 'ForStatement':
      validateScalar(statement.variable);
      validateNumber(statement.start);
      validateNumber(statement.end);
      if (statement.step) validateNumber(statement.step);
      return;
    case 'NextStatement':
      validateScalar(statement.variable);
      return;
    case 'PrintStatement':
      validatePrint(statement);
      return;
    default:
      unsupported(
        statement,
        'REM, LET, IF with a line target, GO TO, GOSUB/RETURN, INPUT, FOR/NEXT, PRINT, RANDOMIZE, STOP and END',
      );
  }
}
