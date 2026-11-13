import {BasicSyntaxError} from '../core/diagnostic.ts';
import {
  eduSystem30OutputCode,
  isEduSystem30PrintableCode,
  parseEduSystem30DataLiteral,
  parseEduSystem30SourceLiteral,
} from '../core/edusystem30_floating.ts';
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
export const eduSystem30FunctionName = /^FN[A-Z]$/;

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
        if (!numericName.test(node.name))
          unsupported(node, 'numeric arrays named with a letter and optional digit');
        pending.push(...node.indices);
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
        pending.push(node.right, node.left);
        break;
      case 'CallExpression':
        if (
          node.arguments.length !== 1 ||
          (!['ABS', 'INT', 'RND', 'SQR', 'EXP'].includes(node.name) &&
            !eduSystem30FunctionName.test(node.name))
        )
          unsupported(node, 'one numeric argument to ABS, INT, RND, SQR, EXP or FN functions');
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
    if (item.type === 'CallExpression' && item.name === 'CHR$' && item.arguments.length === 1) {
      const [argument] = item.arguments;
      validateNumber(argument);
      if (
        argument.type === 'NumberLiteral' &&
        !isEduSystem30PrintableCode(
          eduSystem30OutputCode(parseEduSystem30SourceLiteral(argument.raw)),
        )
      )
        unsupported(argument, 'a printable CHR$ argument or BEL');
      continue;
    }
    if (item.type !== 'StringLiteral') validateNumber(item);
  }
}

export function validateEduSystem30Line(line: ParsedLine): void {
  for (const statement of lineStatements(line)) validateStatement(statement);
}

/** Resolve numbered DEFs before execution, including calls that precede them. */
export function validateEduSystem30Functions(lines: readonly ParsedLine[]): void {
  const definitions = new Set<string>();
  const statements = lines.flatMap(lineStatements);
  for (const statement of statements) {
    if (statement.type === 'DefStatement') definitions.add(statement.name);
  }
  const pending: unknown[] = [...statements].reverse();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object') continue;
    if ('type' in value && value.type === 'CallExpression') {
      const call = value as NodeOf<'CallExpression'>;
      if (eduSystem30FunctionName.test(call.name) && !definitions.has(call.name))
        unsupported(call, `a numbered DEF for ${call.name}`);
    }
    for (const child of Object.values(value).reverse()) pending.push(child);
  }
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
    case 'RestoreStatement':
      return;
    case 'DefStatement':
      if (!eduSystem30FunctionName.test(statement.name))
        unsupported(statement, 'DEF names from FNA through FNZ');
      validateScalar(statement.parameter);
      validateNumber(statement.expression);
      return;
    case 'DimStatement':
      for (const declaration of statement.declarations) {
        if (!numericName.test(declaration.name))
          unsupported(
            declaration,
            'numeric DIM declarations named with a letter and optional digit',
          );
        for (const bound of declaration.bounds) {
          if (bound.value === 0) unsupported(bound, 'positive integer DIM bounds');
        }
      }
      return;
    case 'LetStatement':
      validateNumber(statement.target);
      validateNumber(statement.expression);
      return;
    case 'DataStatement':
      for (const item of statement.items) {
        if (item.type !== 'NumberLiteral' || item.raw.startsWith('+'))
          unsupported(item, 'numeric DATA literals with an optional leading minus');
        try {
          parseEduSystem30DataLiteral(item.raw);
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          unsupported(item, 'numeric DATA literals within the compiled decimal range');
        }
      }
      return;
    case 'ReadStatement':
      statement.targets.forEach(validateNumber);
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
      if (statement.prompt || statement.targets.length > 3)
        unsupported(statement, 'unprompted INPUT with two or three numeric scalars');
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
        'REM, LET, DIM, DEF, DATA/READ/RESTORE, IF with a line target, GO TO, GOSUB/RETURN, INPUT, FOR/NEXT, PRINT, RANDOMIZE, STOP and END',
      );
  }
}
