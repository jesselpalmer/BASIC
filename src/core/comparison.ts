import {BasicRuntimeError} from './diagnostic.ts';
import {nativeIntrinsic} from './intrinsics.ts';
import {basicPlusStringRelation} from './basic_plus_strings.ts';
import {compareMa2Values, type Ma2Value} from './ma2_value.ts';
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
  return relation(left, condition.operator, right);
}

function relation(left: BasicValue, operator: ComparisonOperator, right: BasicValue): boolean {
  switch (operator) {
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

export type Ma2RelationResult =
  | Readonly<{kind: 'value'; value: boolean}>
  | Exclude<ReturnType<typeof compareMa2Values>, {kind: 'value'}>;

/** Internal numeric relations only; no historical strings, IF or public context. */
export function compareMa2Relation(
  left: Ma2Value,
  operator: ComparisonOperator,
  right: Ma2Value,
): Ma2RelationResult {
  if (!['=', '<>', '<', '<=', '>', '>='].includes(operator))
    throw new RangeError('Unsupported MA2 comparison operator');
  const result = compareMa2Values(left, right);
  if (result.kind !== 'value') return result;
  return Object.freeze({kind: 'value', value: relation(result.order, operator, 0)});
}

export type BasicPlusStringRelationResult =
  | Readonly<{kind: 'value'; value: boolean}>
  | Exclude<ReturnType<typeof basicPlusStringRelation>, {kind: 'value'}>;

/** Internal padded string predicate; no source/IF or public profile binding. */
export function compareBasicPlusStringRelation(
  left: string,
  operator: ComparisonOperator,
  right: string,
): BasicPlusStringRelationResult {
  const result = basicPlusStringRelation(left, operator, right);
  return result.kind === 'value'
    ? Object.freeze({kind: 'value', value: result.value === -1})
    : result;
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
      case 'ArrayReference':
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
      case 'Ma2NumberLiteral':
      case 'NumberLiteral':
      case 'UnaryExpression':
        values.push('number');
        break;
      case 'CallExpression':
        values.push(
          node.name === 'CHR$' ? 'string' : (nativeIntrinsic(node.name)?.resultType ?? 'number'),
        );
    }
  }
  return values[0];
}
