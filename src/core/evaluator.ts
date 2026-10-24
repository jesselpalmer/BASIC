import {BasicRuntimeError} from './diagnostic.ts';
import {createHost} from './host.ts';
import {compareValues} from './comparison.ts';
import type {BasicValue, Comparison, Expression, Host, Location, NodeOf} from './types.ts';

function fail(code: string, message: string, location: Location): never {
  throw new BasicRuntimeError(code, message, location.start, location.label);
}

function number(value: unknown, location: Location): number {
  if (typeof value !== 'number') {
    fail('TYPE_MISMATCH', 'Expected a number', location);
  }
  if (!Number.isFinite(value)) {
    fail('NON_FINITE_NUMBER', 'Numbers must be finite', location);
  }
  return value;
}

function binary(node: NodeOf<'BinaryExpression'>, left: BasicValue, right: BasicValue): BasicValue {
  const location = node.operatorLocation;
  if (node.operator === '+' && typeof left === 'string' && typeof right === 'string') {
    return left + right;
  }
  const a = number(left, location);
  const b = number(right, location);
  let result: number;
  switch (node.operator) {
    case '+':
      result = a + b;
      break;
    case '-':
      result = a - b;
      break;
    case '*':
      result = a * b;
      break;
    case '/':
      if (b === 0) fail('DIVISION_BY_ZERO', 'Cannot divide by zero', location);
      result = a / b;
      break;
    default:
      fail('UNSUPPORTED_OPERATOR', `Unsupported operator ${node.operator}`, location);
  }
  return number(result, location);
}

type Frame = {node: Expression; ready: boolean};

/** Evaluates parser-produced expressions; each instance owns its variables. */
export class Evaluator {
  private readonly variables = new Map<string, BasicValue>();
  private readonly host: Pick<Host, 'random'>;

  constructor(host: Partial<Pick<Host, 'random'>> = {}) {
    this.host = createHost(host);
  }

  reset(): void {
    this.variables.clear();
  }

  compare(condition: Comparison): boolean {
    const left = this.evaluate(condition.left);
    const right = this.evaluate(condition.right);
    return compareValues(left, right, condition);
  }

  assign(target: NodeOf<'Variable'>, value: BasicValue): void {
    const name = target.name.toUpperCase();
    if (name.endsWith('$')) {
      if (typeof value !== 'string') {
        fail('TYPE_MISMATCH', `Variable ${name} requires a string`, target.location);
      }
    } else {
      number(value, target.location);
    }
    // Check before writing so a failed assignment preserves the previous value.
    this.variables.set(name, value);
  }

  evaluate(expression: Expression): BasicValue {
    // A flat expression can contain thousands of left-associated nodes. An
    // explicit traversal also preserves left-to-right host callback ordering.
    const pending: Frame[] = [{node: expression, ready: false}];
    const values: BasicValue[] = [];
    while (pending.length) {
      const {node, ready} = pending.pop()!;
      switch (node.type) {
        case 'NumberLiteral':
          values.push(number(node.value, node.location));
          break;
        case 'StringLiteral':
          values.push(node.value);
          break;
        case 'Variable': {
          const name = node.name.toUpperCase();
          const value = this.variables.get(name);
          if (value === undefined) {
            fail('UNDEFINED_VARIABLE', `Undefined variable ${name}`, node.location);
          }
          values.push(value);
          break;
        }
        case 'GroupExpression':
          pending.push({node: node.expression, ready: false});
          break;
        case 'UnaryExpression':
          if (!ready) {
            pending.push({node, ready: true}, {node: node.argument, ready: false});
          } else {
            const value = number(values.pop()!, node.operatorLocation);
            if (node.operator !== '+' && node.operator !== '-') {
              fail(
                'UNSUPPORTED_OPERATOR',
                `Unsupported operator ${node.operator}`,
                node.operatorLocation,
              );
            }
            values.push(number(node.operator === '-' ? -value : value, node.operatorLocation));
          }
          break;
        case 'BinaryExpression':
          if (!ready) {
            pending.push(
              {node, ready: true},
              {node: node.right, ready: false},
              {node: node.left, ready: false},
            );
          } else {
            const right = values.pop()!;
            const left = values.pop()!;
            values.push(binary(node, left, right));
          }
          break;
        case 'CallExpression':
          if (!ready) {
            const arity =
              node.name === 'RND' ? 0 : node.name === 'ABS' || node.name === 'INT' ? 1 : null;
            if (arity === null)
              fail('UNKNOWN_FUNCTION', `Unknown function ${node.name}`, node.nameLocation);
            if (node.arguments.length !== arity) {
              fail(
                'INVALID_ARGUMENT_COUNT',
                `${node.name} expects ${arity} argument(s)`,
                node.nameLocation,
              );
            }
            pending.push({node, ready: true});
            for (let i = node.arguments.length - 1; i >= 0; i--) {
              pending.push({node: node.arguments[i], ready: false});
            }
          } else if (node.name === 'RND') {
            values.push(this.nextRandom(node.nameLocation));
          } else {
            const value = number(values.pop()!, node.nameLocation);
            values.push(node.name === 'ABS' ? Math.abs(value) : Math.floor(value));
          }
          break;
      }
    }
    return values[0];
  }

  private nextRandom(location: Location): number {
    let value: number;
    try {
      value = this.host.random();
    } catch (cause) {
      throw new BasicRuntimeError(
        'RANDOM_FAILED',
        'Random source failed',
        location.start,
        location.label,
        {cause},
      );
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
      fail('INVALID_RANDOM_VALUE', 'Random source must return a number >= 0 and < 1', location);
    }
    return value;
  }
}
