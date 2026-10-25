import type {LanguageOptions, NodeOf, ParsedLine, Program, Statement} from '../core/types.ts';
import {validateDialect} from '../core/dialect.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {comparisonTypeError, expressionType} from '../core/comparison.ts';
import {graphicsArguments} from '../core/graphics.ts';
import {pairLoops} from '../core/loops.ts';
import {validateArrays} from '../core/array_declarations.ts';
import {maxPrintUsingValues} from '../core/print_using.ts';
import {programInstructions} from '../core/instructions.ts';

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

// Whole-program checks stay separate from single-line editing so incomplete
// forward targets and loops can remain in an editor candidate.
export function validateProgram(
  lines: readonly ParsedLine[],
  options: LanguageOptions = {},
): Program {
  const dialect = validateDialect(options.dialect);
  if (!isArray(lines) || lines.some((line) => line?.type !== 'Line')) {
    throw new TypeError('Expected an array of parsed lines');
  }
  const labels = new Set();
  for (const line of lines) {
    validateDialect(line.dialect, dialect);
    if (labels.has(line.label)) {
      throw new BasicSyntaxError(
        'DUPLICATE_LABEL',
        `Duplicate line label ${line.label}`,
        line.location.start,
        line.label,
      );
    }
    labels.add(line.label);
  }
  for (const {statement} of programInstructions(lines)) {
    validateKeyboardArguments(statement);
    if (statement.type === 'PrintUsingStatement') {
      if (expressionType(statement.format) === 'number') {
        throw new BasicSyntaxError(
          'TYPE_MISMATCH',
          'PRINT USING requires a string image',
          statement.format.location.start,
          statement.location.label,
        );
      }
      if (statement.items.length > maxPrintUsingValues) {
        throw new BasicSyntaxError(
          'FORMAT_LIMIT',
          `PRINT USING permits at most ${maxPrintUsingValues} values`,
          statement.location.start,
          statement.location.label,
        );
      }
    }
    if (statement.type === 'WaitStatement' && expressionType(statement.duration) === 'string') {
      throw new BasicSyntaxError(
        'TYPE_MISMATCH',
        'WAIT duration must be numeric',
        statement.duration.location.start,
        statement.location.label,
      );
    }
    if (
      statement.type === 'ColorStatement' ||
      statement.type === 'PsetStatement' ||
      statement.type === 'LineStatement' ||
      statement.type === 'CircleStatement'
    ) {
      for (const argument of graphicsArguments(statement)) {
        if (expressionType(argument) === 'string') {
          throw new BasicSyntaxError(
            'TYPE_MISMATCH',
            'Graphics arguments must be numeric',
            argument.location.start,
            statement.location.label,
          );
        }
      }
    }
    if (
      statement.type !== 'GotoStatement' &&
      statement.type !== 'IfStatement' &&
      statement.type !== 'GosubStatement'
    )
      continue;
    if (!labels.has(statement.target.value)) {
      throw new BasicSyntaxError(
        'MISSING_TARGET',
        `No line label ${statement.target.value}`,
        statement.target.location.start,
        statement.location.label,
      );
    }
    if (statement.type === 'IfStatement') {
      const condition = statement.condition;
      const problem = comparisonTypeError(
        expressionType(condition.left),
        condition.operator,
        expressionType(condition.right),
      );
      if (problem)
        throw new BasicSyntaxError(
          'TYPE_MISMATCH',
          problem,
          condition.operatorLocation.start,
          condition.location.label,
        );
    }
  }
  // Clone before freezing: a snapshot never freezes or retains caller-owned
  // arrays/nodes, and a failed candidate cannot modify an existing program.
  const snapshot = copyTree(lines)
    .map((line) => ({...line, dialect}))
    .sort((a, b) => a.label - b.label);
  pairLoops(programInstructions(snapshot));
  validateArrays(snapshot);
  return freezeTree({type: 'Program', dialect, lines: snapshot});
}

// ASTs contain only plain objects, arrays, and primitives. Copy iteratively so
// a long left-associative expression cannot exhaust the JavaScript call stack.
function copyTree(root: readonly ParsedLine[]): ParsedLine[] {
  const copy: ParsedLine[] = [];
  const copies = new Map<object, object>([[root, copy]]);
  const pending: object[] = [root];
  while (pending.length) {
    const source = pending.pop()!;
    const target = copies.get(source)!;
    const entries: [string, unknown][] = Object.entries(source);
    for (const [key, value] of entries) {
      if (value !== null && typeof value === 'object') {
        if (!copies.has(value)) {
          copies.set(value, Array.isArray(value) ? [] : {});
          pending.push(value);
        }
        Reflect.set(target, key, copies.get(value));
      } else {
        Reflect.set(target, key, value);
      }
    }
  }
  return copy;
}

export function freezeTree<T>(root: T): T {
  const pending: unknown[] = [root];
  const visited = new Set();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object' || visited.has(value)) {
      continue;
    }
    visited.add(value);
    for (const child of Object.values(value)) pending.push(child);
    Object.freeze(value);
  }
  return root;
}

// Inspect every expression position without executing it. Traversal includes
// nested calls and remains iterative for the same flat trees as evaluation.
function validateKeyboardArguments(statement: Statement): void {
  const pending: unknown[] = [statement];
  const visited = new Set<object>();
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    if ('type' in value && value.type === 'CallExpression') {
      const call = value as NodeOf<'CallExpression'>;
      if (
        call.name === 'KEYDOWN' &&
        call.arguments.length === 1 &&
        expressionType(call.arguments[0]) === 'number'
      ) {
        throw new BasicSyntaxError(
          'TYPE_MISMATCH',
          'KEYDOWN requires a string key name',
          call.arguments[0].location.start,
          call.location.label,
        );
      }
    }
    for (const child of Object.values(value)) pending.push(child);
  }
}
