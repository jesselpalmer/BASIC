import {BasicRuntimeError} from './diagnostic.ts';
import type {BasicValue, Comparison, ComparisonOperator, Expression} from './types.ts';

type ValueType = 'number' | 'string';

export function comparisonTypeError(
  left: ValueType | null,
  operator: ComparisonOperator,
  right: ValueType | null,
): string | null {
  if (left === null || right === null) return null;
  if (left !== right) return 'Comparison requires two numbers or two strings';
  if (left === 'string' && operator !== '=' && operator !== '<>') {
    return 'Strings support only = and <> comparisons';
  }
  return null;
}

export function compareValues(left: BasicValue, right: BasicValue, condition: Comparison): boolean {
  const problem = comparisonTypeError(
    typeof left === 'string' ? 'string' : 'number',
    condition.operator,
    typeof right === 'string' ? 'string' : 'number',
  );
  if (problem) {
    throw new BasicRuntimeError(
      'TYPE_MISMATCH',
      problem,
      condition.operatorLocation.start,
      condition.location.label,
    );
  }
  switch (condition.operator) {
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
  }
}

// Infer result types without evaluating values, reading variables, or calling
// hosts. Invalid mixed + expressions remain for normal evaluator diagnostics.
export function expressionType(expression: Expression): ValueType | null {
  const pending = [{node: expression, ready: false}];
  const values: (ValueType | null)[] = [];
  while (pending.length) {
    const {node, ready} = pending.pop()!;
    switch (node.type) {
      case 'StringLiteral':
        values.push('string');
        break;
      case 'Variable':
        values.push(node.name.endsWith('$') ? 'string' : 'number');
        break;
      case 'GroupExpression':
        pending.push({node: node.expression, ready: false});
        break;
      case 'BinaryExpression':
        if (node.operator !== '+') values.push('number');
        else if (!ready)
          pending.push(
            {node, ready: true},
            {node: node.right, ready: false},
            {node: node.left, ready: false},
          );
        else {
          const right = values.pop()!;
          const left = values.pop()!;
          values.push(left === right ? left : null);
        }
        break;
      case 'NumberLiteral':
      case 'UnaryExpression':
        values.push('number');
        break;
      case 'CallExpression':
        values.push(node.name === 'INKEY$' ? 'string' : 'number');
    }
  }
  return values[0];
}
