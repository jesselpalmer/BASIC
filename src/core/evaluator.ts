import {BasicSyntaxError, BasicRuntimeError} from './diagnostic.ts';
import {changeOperands} from './change.ts';
import {createHost} from './host.ts';
import {validateDialect} from './dialect.ts';
import {ArrayStore} from './arrays.ts';
import {compareValues} from './comparison.ts';
import {firstMa2Literal} from './foreign_literal.ts';
import {nativeIntrinsic} from './intrinsics.ts';
import {readKey, keyDown} from './keyboard.ts';
import {parseBasicPlusMa2NumericExpression} from '../parser/parser.ts';
import {ma2Binary, ma2Unary, type Ma2Value, type Ma2BinaryResult} from './ma2_value.ts';
import type {
  BasicValue,
  SourceOptions,
  ArrayDeclaration,
  ArraySnapshot,
  AssignmentTarget,
  Dialect,
  LanguageOptions,
  Comparison,
  Expression,
  Host,
  Location,
  NodeOf,
  VariableSnapshot,
} from './types.ts';

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
    case '^':
      if (a === 0 && b < 0)
        fail('DIVISION_BY_ZERO', 'Cannot raise zero to a negative power', location);
      if (a < 0 && !Number.isInteger(b))
        fail('NUMERIC_DOMAIN', 'A negative base requires an integer exponent', location);
      result = Math.pow(a, b);
      break;
    default:
      fail('UNSUPPORTED_OPERATOR', `Unsupported operator ${node.operator}`, location);
  }
  return number(result, location);
}

type Frame = {node: Expression; ready: boolean};

/** Evaluates parser-produced expressions; each instance owns its variables. */
export class Evaluator {
  readonly #dialect: Dialect;
  private readonly variables = new Map<string, BasicValue>();
  private arrays = new ArrayStore();
  private readonly host: Pick<Host, 'random' | 'readKey' | 'keyDown'>;

  constructor(
    host: Partial<Pick<Host, 'random' | 'readKey' | 'keyDown'>> = {},
    options: LanguageOptions = {},
  ) {
    this.#dialect = validateDialect(options.dialect);
    this.host = createHost(host);
  }

  get dialect(): Dialect {
    return this.#dialect;
  }

  reset(declarations: readonly ArrayDeclaration[] = []): void {
    const arrays = new ArrayStore(declarations);
    this.variables.clear();
    this.arrays = arrays;
  }

  snapshotArrays(): readonly ArraySnapshot[] {
    return this.arrays.snapshot();
  }

  change(statement: NodeOf<'ChangeStatement'>): void {
    const {array, string, toArray} = changeOperands(statement);
    if (toArray) this.arrays.changeToNumbers(array, this.evaluate(string));
    else this.assign(string, this.arrays.changeToString(array));
  }

  snapshotVariables(): readonly VariableSnapshot[] {
    return Object.freeze(
      Array.from(this.variables, ([name, value]) => Object.freeze({name, value})),
    );
  }

  compare(condition: Comparison): boolean {
    this.rejectForeignLiterals(condition);
    const left = this.evaluate(condition.left);
    const right = this.evaluate(condition.right);
    return compareValues(left, right, condition);
  }

  assign(target: AssignmentTarget, value: BasicValue): void {
    this.rejectForeignLiterals(target);
    const name = target.name.toUpperCase();
    if (name.endsWith('$')) {
      if (typeof value !== 'string') {
        fail('TYPE_MISMATCH', `Variable ${name} requires a string`, target.location);
      }
    } else {
      number(value, target.location);
    }
    // Check before writing so a failed assignment preserves the previous value.
    if (target.type === 'ArrayReference') {
      this.arrays.checkReference(target);
      const indices = target.indices.map((index) => this.evaluate(index));
      this.arrays.write(target, indices, value);
    } else this.variables.set(name, value);
  }

  private rejectForeignLiterals(tree: unknown): void {
    const foreign = firstMa2Literal(tree);
    if (foreign)
      fail(
        'UNSUPPORTED_NUMERIC_LITERAL',
        'MA2 literals require a supported historical context',
        foreign.location,
      );
  }

  evaluate(expression: Expression): BasicValue {
    if (expression.type !== 'Ma2NumberLiteral') this.rejectForeignLiterals(expression);
    return evaluateTree(expression, {
      kind: 'native',
      variables: this.variables,
      arrays: () => this.arrays,
      host: this.host,
      random: (location) => this.nextRandom(location),
    });
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

interface NativeContext {
  readonly kind: 'native';
  readonly variables: ReadonlyMap<string, BasicValue>;
  readonly arrays: () => ArrayStore;
  readonly host: Pick<Host, 'random' | 'readKey' | 'keyDown'>;
  readonly random: (location: Location) => number;
}
interface Ma2Context {
  readonly kind: 'ma2-conformance';
}
type Ma2Failure = Exclude<Ma2BinaryResult | ReturnType<typeof ma2Unary>, {kind: 'value'}>;
export type Ma2ConstantResult =
  Readonly<{kind: 'value'; value: Ma2Value}> | (Ma2Failure & Readonly<{location: Location}>);

/** Internal source-only constant conformance; no Program or public dialect. */
export function evaluateBasicPlusMa2Constant(
  source: string,
  options: Pick<SourceOptions, 'line' | 'offset'> = {},
): Ma2ConstantResult {
  const expression = parseBasicPlusMa2NumericExpression(source, options);
  requireMa2ConstantSyntax(expression);
  return evaluateTree(expression, {kind: 'ma2-conformance'});
}

/** Closed syntax inventory only; execution accepts canonical parser trees. */
export function requireMa2ConstantSyntax(expression: Expression): void {
  const reject = (code: string, message: string, location: Location): never => {
    throw new BasicSyntaxError(code, message, location.start, location.label);
  };
  const pending: Expression[] = [expression];
  while (pending.length) {
    const node = pending.pop()!;
    switch (node.type) {
      case 'Ma2NumberLiteral':
        break;
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'Variable':
      case 'ArrayReference':
        return reject(
          'UNSUPPORTED_EXPRESSION',
          'MA2 constant conformance requires constant MA2 numeric syntax',
          node.location,
        );
      case 'GroupExpression':
        pending.push(node.expression);
        break;
      case 'UnaryExpression':
        if (node.operator !== '+' && node.operator !== '-')
          reject(
            'UNSUPPORTED_OPERATOR',
            'Unsupported constant MA2 unary operator',
            node.operatorLocation,
          );
        pending.push(node.argument);
        break;
      case 'BinaryExpression':
        if (!['+', '-', '*', '/'].includes(node.operator))
          reject(
            'UNSUPPORTED_OPERATOR',
            'Unsupported constant MA2 binary operator',
            node.operatorLocation,
          );
        pending.push(node.right, node.left);
        break;
      case 'CallExpression':
        if (node.name !== 'INT' && node.name !== 'ABS')
          reject('UNSUPPORTED_FUNCTION', 'Unsupported constant MA2 intrinsic', node.nameLocation);
        if (node.arguments.length !== 1)
          reject(
            'INVALID_ARGUMENT_COUNT',
            'Constant MA2 intrinsics require one argument',
            node.nameLocation,
          );
        pending.push(...node.arguments);
        break;
    }
  }
}

function evaluateTree(expression: Expression, context: NativeContext): BasicValue;
function evaluateTree(expression: Expression, context: Ma2Context): Ma2ConstantResult;
function evaluateTree(
  expression: Expression,
  context: NativeContext | Ma2Context,
): BasicValue | Ma2ConstantResult {
  // A flat expression can contain thousands of left-associated nodes. An
  // explicit traversal also preserves left-to-right host callback ordering.
  const pending: Frame[] = [{node: expression, ready: false}];
  const values: (BasicValue | Ma2Value)[] = [];
  while (pending.length) {
    const {node, ready} = pending.pop()!;
    let ma2Operation:
      {result: ReturnType<typeof ma2Unary> | Ma2BinaryResult; location: Location} | undefined;
    switch (node.type) {
      case 'Ma2NumberLiteral':
        if (context.kind === 'native')
          return fail(
            'UNSUPPORTED_NUMERIC_LITERAL',
            'MA2 literals require a supported historical context',
            node.location,
          );
        // The source-only MA2 entry supplies validated immutable parser literals.
        values.push(Object.freeze({kind: 'ma2', words: node.words}));
        break;
      case 'NumberLiteral':
        values.push(number(node.value, node.location));
        break;
      case 'StringLiteral':
        values.push(node.value);
        break;
      case 'Variable': {
        const name = node.name.toUpperCase();
        const value = (context as NativeContext).variables.get(name);
        if (value === undefined) {
          fail('UNDEFINED_VARIABLE', `Undefined variable ${name}`, node.location);
        }
        values.push(value);
        break;
      }
      case 'ArrayReference':
        if (!ready) {
          (context as NativeContext).arrays().checkReference(node);
          pending.push({node, ready: true});
          for (let i = node.indices.length - 1; i >= 0; i--) {
            pending.push({node: node.indices[i], ready: false});
          }
        } else {
          const indices = values.splice(values.length - node.indices.length) as BasicValue[];
          values.push((context as NativeContext).arrays().read(node, indices));
        }
        break;
      case 'GroupExpression':
        pending.push({node: node.expression, ready: false});
        break;
      case 'UnaryExpression':
        if (!ready) {
          pending.push({node, ready: true}, {node: node.argument, ready: false});
        } else if (context.kind === 'ma2-conformance') {
          const input = values.pop()! as Ma2Value;
          ma2Operation = {
            result:
              node.operator === '+' ? {kind: 'value', value: input} : ma2Unary(input, 'negate'),
            location: node.operatorLocation,
          };
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
          if (context.kind === 'ma2-conformance') {
            const operation =
              node.operator === '+'
                ? 'add'
                : node.operator === '-'
                  ? 'subtract'
                  : node.operator === '*'
                    ? 'multiply'
                    : 'divide';
            ma2Operation = {
              result: ma2Binary(left as Ma2Value, operation, right as Ma2Value),
              location: node.operatorLocation,
            };
          } else values.push(binary(node, left as BasicValue, right as BasicValue));
        }
        break;
      case 'CallExpression':
        if (!ready) {
          if (context.kind === 'native') {
            const signature = nativeIntrinsic(node.name);
            if (signature === null)
              fail('UNKNOWN_FUNCTION', `Unknown function ${node.name}`, node.nameLocation);
            if (node.arguments.length !== signature.arity) {
              fail(
                'INVALID_ARGUMENT_COUNT',
                `${signature.name} expects ${signature.arity} argument(s)`,
                node.nameLocation,
              );
            }
          }
          pending.push({node, ready: true});
          for (let i = node.arguments.length - 1; i >= 0; i--) {
            pending.push({node: node.arguments[i], ready: false});
          }
        } else if (context.kind === 'ma2-conformance') {
          ma2Operation = {
            result: ma2Unary(
              values.pop()! as Ma2Value,
              node.name === 'ABS' ? 'absolute' : 'integer',
            ),
            location: node.nameLocation,
          };
        } else if (node.name === 'INKEY$') {
          values.push(readKey(context.host, node.nameLocation));
        } else if (node.name === 'KEYDOWN') {
          values.push(keyDown(context.host, values.pop()! as BasicValue, node.nameLocation));
        } else if (node.name === 'RND') {
          values.push(context.random(node.nameLocation));
        } else {
          const value = number(values.pop()!, node.nameLocation);
          values.push(node.name === 'ABS' ? Math.abs(value) : Math.floor(value));
        }
        break;
    }
    if (ma2Operation) {
      const {result, location} = ma2Operation;
      if (result.kind !== 'value') return Object.freeze({...result, location});
      values.push(result.value);
    }
  }
  return context.kind === 'native'
    ? (values[0] as BasicValue)
    : Object.freeze({kind: 'value', value: values[0] as Ma2Value});
}
