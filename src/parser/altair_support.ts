import {BasicSyntaxError} from '../core/diagnostic.ts';
import {lineStatements} from '../core/instructions.ts';
import type {Expression, Location, ParsedLine} from '../core/types.ts';

function unsupported({location}: {location: Location}, detail: string): never {
  throw new BasicSyntaxError('UNSUPPORTED_ALTAIR_FORM', detail, location.start, location.label);
}

function validateName(name: string, node: {location: Location}): void {
  if (!/^[A-Z]\d?$/.test(name)) unsupported(node, 'Altair requires short numeric names');
}

function validateNumber(...pending: Expression[]): void {
  while (pending.length) {
    const expression = pending.pop()!;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (expression.type) {
      case 'NumberLiteral':
        break;
      case 'Variable':
        validateName(expression.name, expression);
        break;
      case 'ArrayReference':
        validateName(expression.name, expression);
        pending.push(...expression.indices);
        break;
      case 'GroupExpression':
        pending.push(expression.expression);
        break;
      case 'UnaryExpression':
        pending.push(expression.argument);
        break;
      case 'BinaryExpression':
        if (!['+', '-', '*', '/'].includes(expression.operator))
          unsupported(expression, 'Altair supports +, -, * and / in this profile');
        pending.push(expression.left, expression.right);
        break;
      default:
        unsupported(expression, 'Expected an Altair numeric expression');
    }
  }
}

export function validateAltairLine(line: ParsedLine): void {
  for (const statement of lineStatements(line)) {
    // Forms outside the game-facing allowlist fail before any host effects.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (statement.type) {
      case 'DimStatement':
        for (const declaration of statement.declarations)
          validateName(declaration.name, declaration);
        break;
      case 'DataStatement':
        for (const item of statement.items) validateNumber(item);
        break;
      case 'ReadStatement':
        validateNumber(...statement.targets);
        break;
      case 'LetStatement':
        validateNumber(statement.target, statement.expression);
        break;
      case 'ForStatement':
        validateNumber(statement.variable, statement.start, statement.end);
        if (statement.step) validateNumber(statement.step);
        break;
      case 'NextStatement':
        validateNumber(statement.variable);
        break;
      case 'IfStatement':
      case 'InlineIfStatement':
        validateNumber(statement.condition.left, statement.condition.right);
        break;
      case 'InputStatement':
      case 'InputTargetsStatement':
        if (statement.prompt)
          unsupported(statement.prompt, 'Altair requires unprompted numeric INPUT');
        validateNumber(
          ...(statement.type === 'InputStatement' ? [statement.target] : statement.targets),
        );
        break;
      case 'PrintStatement':
        if (
          statement.items.length &&
          statement.separators.length !==
            statement.items.length - (statement.trailingSemicolon ? 0 : 1)
        )
          unsupported(statement, 'Altair requires semicolon-separated PRINT items');
        for (const item of statement.items) {
          if (item.type === 'StringLiteral') {
            if (!/^[ -~]*$/.test(item.value))
              unsupported(item, 'Altair PRINT literals require printable ASCII');
          } else if (item.type === 'CallExpression' && ['TAB', 'CHR$'].includes(item.name)) {
            if (item.arguments.length !== 1)
              unsupported(item, `${item.name} requires one argument`);
            validateNumber(item.arguments[0]);
          } else validateNumber(item);
        }
        break;
      case 'GotoStatement':
      case 'GosubStatement':
      case 'ReturnStatement':
      case 'RemStatement':
      case 'RunStatement':
      case 'EndStatement':
        break;
      default:
        unsupported(statement, 'Statement is outside the Altair LIFE2 profile');
    }
  }
}

/** Preallocated explicit arrays are equivalent for an initial DIM prologue. */
export function validateAltairDimensions(lines: readonly ParsedLine[]): void {
  let executable = false;
  const dimLabels = new Set<number>();
  const transfers: Extract<Expression, {type: 'NumberLiteral'}>[] = [];
  for (const line of lines) {
    for (const statement of lineStatements(line)) {
      if (statement.type === 'RemStatement' || statement.type === 'DataStatement') continue;
      if (statement.type === 'DimStatement') {
        if (executable) unsupported(statement, 'Altair DIM must precede executable statements');
        dimLabels.add(line.label);
        continue;
      }
      executable = true;
      if (
        statement.type === 'GotoStatement' ||
        statement.type === 'GosubStatement' ||
        statement.type === 'IfStatement'
      )
        transfers.push(statement.target);
    }
  }
  for (const target of transfers)
    if (dimLabels.has(target.value))
      unsupported(target, 'Altair cannot branch to the DIM prologue');
}
