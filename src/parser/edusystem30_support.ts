import {BasicSyntaxError} from '../core/diagnostic.ts';
import {parseEduSystem30SourceLiteral} from '../core/edusystem30_floating.ts';
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

const numericName = /^[A-Z][0-9]?$/;

function validateScalar(node: Expression): void {
  if (node.type !== 'Variable' || !numericName.test(node.name))
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
      case 'ArrayReference':
        if (!numericName.test(node.name) || node.indices.length !== 1)
          unsupported(
            node,
            'one-dimensional numeric arrays named with a letter and optional digit',
          );
        pending.push(node.indices[0]);
        break;
      case 'NumberLiteral':
        try {
          parseEduSystem30SourceLiteral(node.raw);
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          unsupported(node, 'numeric literals within the compiled decimal range');
        }
        break;
      case 'GroupExpression':
        pending.push(node.expression);
        break;
      case 'UnaryExpression':
        if (!['+', '-'].includes(node.operator)) unsupported(node, 'unary + and -');
        pending.push(node.argument);
        break;
      case 'BinaryExpression':
        if (node.operator === '^') {
          if (node.right.type !== 'NumberLiteral' || !/^[2-5]$/.test(node.right.raw))
            unsupported(node.right, 'literal exponents 2 through 5');
        }
        pending.push(node.right, node.left);
        break;
      case 'CallExpression':
        if (!['ABS', 'INT', 'RND', 'SQR'].includes(node.name) || node.arguments.length !== 1)
          unsupported(node, 'one numeric argument to ABS, INT, RND and SQR');
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
    case 'DimStatement':
      for (const declaration of statement.declarations) {
        if (!numericName.test(declaration.name) || declaration.bounds.length !== 1)
          unsupported(declaration, 'one-dimensional numeric DIM declarations');
        const [bound] = declaration.bounds;
        if (bound.value === 0) unsupported(bound, 'positive integer DIM bounds');
      }
      return;
    case 'LetStatement':
      validateNumber(statement.target);
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
        'REM, LET, DIM, IF with a line target, GO TO, GOSUB/RETURN, INPUT, FOR/NEXT, PRINT, RANDOMIZE, STOP and END',
      );
  }
}
