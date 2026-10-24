import type {ParsedLine, Program} from '../core/types.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {comparisonTypeError, expressionType} from '../core/comparison.ts';
import {graphicsArguments} from '../core/graphics.ts';
import {pairLoops} from '../core/loops.ts';

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

// Whole-program checks stay separate from single-line editing so incomplete
// forward targets and loops can remain in an editor candidate.
export function validateProgram(lines: readonly ParsedLine[]): Program {
  if (!isArray(lines) || lines.some((line) => line?.type !== 'Line')) {
    throw new TypeError('Expected an array of parsed lines');
  }
  const labels = new Set();
  for (const line of lines) {
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
  for (const {statement} of lines) {
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
    if (statement.type !== 'GotoStatement' && statement.type !== 'IfStatement') continue;
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
  const snapshot = copyTree(lines).sort((a, b) => a.label - b.label);
  pairLoops(snapshot);
  return freezeTree({type: 'Program', lines: snapshot});
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
