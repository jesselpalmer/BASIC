import {BasicSyntaxError, BasicRuntimeError} from './diagnostic.ts';
import {changeOperands} from './change.ts';
import {createHost} from './host.ts';
import {validateDialect} from './dialect.ts';
import {ArrayStore, createBasicPlusMa2ArrayStore} from './arrays.ts';
import {compareValues, compareMa2Relation, type Ma2RelationResult} from './comparison.ts';
import {firstMa2Literal} from './foreign_literal.ts';
import {nativeIntrinsic} from './intrinsics.ts';
import {readKey, keyDown} from './keyboard.ts';
import {
  parseBasicPlusMa2NumericExpression,
  parseBasicPlusMa2NumericComparison,
} from '../parser/parser.ts';
import {
  ma2Binary,
  ma2Unary,
  injectMa2Value,
  observeMa2Value,
  type Ma2Value,
  type Ma2BinaryResult,
} from './ma2_value.ts';
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
  readonly scalars: ReadonlyMap<string, Ma2Value> | null;
  readonly arrays: ArrayStore | null;
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
  return evaluateTree(expression, {kind: 'ma2-conformance', scalars: null, arrays: null});
}

/** Closed syntax inventory only; execution accepts canonical parser trees. */
export function requireMa2ConstantSyntax(expression: Expression): void {
  requireMa2NumericSyntax(expression, false);
}

function requireMa2NumericSyntax(
  expression: Expression,
  scalars: boolean,
  arrays: ArrayStore | null = null,
): void {
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
        return reject(
          'UNSUPPORTED_EXPRESSION',
          'MA2 constant conformance requires constant MA2 numeric syntax',
          node.location,
        );
      case 'ArrayReference':
        if (arrays === null)
          return reject(
            'UNSUPPORTED_EXPRESSION',
            'MA2 array syntax requires an explicit array conformance session',
            node.location,
          );
        arrays.checkReference(node);
        pending.push(...node.indices.toReversed());
        break;
      case 'Variable':
        if (!scalars)
          return reject(
            'UNSUPPORTED_EXPRESSION',
            'Constant MA2 syntax cannot read scalar state',
            node.location,
          );
        break;
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

type ScalarInjectionFailure = Exclude<ReturnType<typeof injectMa2Value>, {kind: 'value'}>;
export type Ma2ScalarInjectionResult =
  | Extract<ReturnType<typeof injectMa2Value>, {kind: 'value'}>
  | (ScalarInjectionFailure & Readonly<{location: Location}>);

export type Ma2ComparisonResult =
  | (Ma2RelationResult & Readonly<{location: Location}>)
  | Exclude<Ma2ConstantResult, {kind: 'value'}>;

/** Internal numeric storage conformance; no Program, statements or public profile. */
export function createBasicPlusMa2ScalarSession() {
  return new Ma2ScalarSession();
}

/** Internal explicit array/scalar conformance; no historical index policy. */
export function createBasicPlusMa2ArraySession(declarations: readonly ArrayDeclaration[] = []) {
  if (!Array.isArray(declarations)) throw new TypeError('Expected explicit array declarations');
  return new Ma2ScalarSession(declarations);
}

class Ma2ScalarSession {
  readonly #scalars = new Map<string, Ma2Value>();
  #arrays: ArrayStore | null;

  constructor(declarations: readonly ArrayDeclaration[] | null = null) {
    this.#arrays = declarations === null ? null : createBasicPlusMa2ArrayStore(declarations);
  }

  private context(): Ma2Context {
    return {kind: 'ma2-conformance', scalars: this.#scalars, arrays: this.#arrays};
  }

  evaluate(
    source: string,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ConstantResult {
    const expression = parseBasicPlusMa2NumericExpression(source, options);
    requireMa2NumericSyntax(expression, true, this.#arrays);
    return evaluateTree(expression, this.context());
  }

  compare(
    source: string,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ComparisonResult {
    const condition = parseBasicPlusMa2NumericComparison(source, options);
    requireMa2NumericSyntax(condition.left, true, this.#arrays);
    requireMa2NumericSyntax(condition.right, true, this.#arrays);
    const context = this.context();
    const left = evaluateTree(condition.left, context);
    if (left.kind !== 'value') return left;
    const right = evaluateTree(condition.right, context);
    if (right.kind !== 'value') return right;
    return Object.freeze({
      ...compareMa2Relation(left.value, condition.operator, right.value),
      location: condition.operatorLocation,
    });
  }

  assign(
    name: string,
    source: string,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ConstantResult {
    const target = this.target(name, options);
    const result = this.evaluate(source, options);
    if (result.kind === 'value') this.#scalars.set(target.name, result.value);
    return result;
  }

  inject(
    name: string,
    input: number,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ScalarInjectionResult {
    const target = this.target(name, options);
    const result = injectMa2Value(input);
    if (result.kind !== 'value') return Object.freeze({...result, location: target.location});
    this.#scalars.set(target.name, result.value);
    return result;
  }

  snapshot(): readonly VariableSnapshot[] {
    return Object.freeze(
      Array.from(this.#scalars, ([name, value]) => {
        // Only canonical parser/injection descriptors can enter this private Map.
        const observation = observeMa2Value(value) as Extract<
          ReturnType<typeof observeMa2Value>,
          {kind: 'value'}
        >;
        return Object.freeze({name, value: observation.value});
      }),
    );
  }

  snapshotArrays(): readonly ArraySnapshot[] {
    return this.#arrays?.snapshot() ?? Object.freeze([]);
  }

  reset(declarations: readonly ArrayDeclaration[] = []): void {
    const arrays = this.#arrays === null ? null : createBasicPlusMa2ArrayStore(declarations);
    this.#scalars.clear();
    this.#arrays = arrays;
  }

  assignElement(
    targetSource: string,
    source: string,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ConstantResult {
    const target = this.elementTarget(targetSource, options);
    // Preflight both trees before any RHS/index numeric work.
    const expression = parseBasicPlusMa2NumericExpression(source, options);
    requireMa2NumericSyntax(expression, true, this.#arrays);
    return this.writeElement(target, evaluateTree(expression, this.context()));
  }

  injectElement(
    targetSource: string,
    input: number,
    options: Pick<SourceOptions, 'line' | 'offset'> = {},
  ): Ma2ConstantResult | Ma2ScalarInjectionResult {
    const target = this.elementTarget(targetSource, options);
    const result = injectMa2Value(input);
    if (result.kind !== 'value') return Object.freeze({...result, location: target.location});
    return this.writeElement(target, result);
  }

  private elementTarget(
    source: string,
    options: Pick<SourceOptions, 'line' | 'offset'>,
  ): NodeOf<'ArrayReference'> {
    const target = parseBasicPlusMa2NumericExpression(source, options);
    if (target.type !== 'ArrayReference')
      throw new BasicSyntaxError(
        'UNSUPPORTED_ASSIGNMENT_TARGET',
        'MA2 element conformance requires one array target',
        target.location.start,
        target.location.label,
      );
    requireMa2NumericSyntax(target, true, this.#arrays);
    return target;
  }

  private writeElement(
    target: NodeOf<'ArrayReference'>,
    result: Ma2ConstantResult,
  ): Ma2ConstantResult {
    if (result.kind !== 'value') return result;
    const indices: Ma2Value[] = [];
    for (const expression of target.indices) {
      const index = evaluateTree(expression, this.context());
      if (index.kind !== 'value') return index;
      indices.push(index.value);
    }
    this.#arrays!.writeMa2(target, ma2IntegerIndices(target, indices), result.value);
    return result;
  }

  private target(
    name: string,
    options: Pick<SourceOptions, 'line' | 'offset'>,
  ): NodeOf<'Variable'> {
    if (typeof name !== 'string') throw new TypeError('Expected a scalar target spelling');
    const target = parseBasicPlusMa2NumericExpression(name, options);
    if (target.type !== 'Variable')
      throw new BasicSyntaxError(
        'UNSUPPORTED_ASSIGNMENT_TARGET',
        'MA2 scalar conformance requires one numeric scalar target',
        target.location.start,
        target.location.label,
      );
    return target;
  }
}

function ma2IntegerIndices(
  reference: NodeOf<'ArrayReference'>,
  values: readonly Ma2Value[],
): number[] {
  return values.map((value, index) => {
    // Canonical MA2 observations are exact; this conformance stage never truncates.
    const observed = observeMa2Value(value) as Extract<
      ReturnType<typeof observeMa2Value>,
      {kind: 'value'}
    >;
    if (!Number.isSafeInteger(observed.value))
      fail(
        'UNSUPPORTED_MA2_INDEX',
        'MA2 array conformance requires exact safe integer indices',
        reference.indices[index].location,
      );
    return observed.value;
  });
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
        const value =
          context.kind === 'native' ? context.variables.get(name) : context.scalars?.get(name);
        if (value === undefined) {
          fail(
            context.kind === 'native' ? 'UNDEFINED_VARIABLE' : 'UNBOUND_MA2_SCALAR',
            context.kind === 'native'
              ? `Undefined variable ${name}`
              : `Unbound MA2 conformance scalar ${name}`,
            node.location,
          );
        }
        values.push(value);
        break;
      }
      case 'ArrayReference':
        if (!ready) {
          (context.kind === 'native' ? context.arrays() : context.arrays!).checkReference(node);
          pending.push({node, ready: true});
          for (let i = node.indices.length - 1; i >= 0; i--) {
            pending.push({node: node.indices[i], ready: false});
          }
        } else {
          const indices = values.splice(values.length - node.indices.length);
          values.push(
            context.kind === 'native'
              ? context.arrays().read(node, indices as BasicValue[])
              : context.arrays!.readMa2(node, ma2IntegerIndices(node, indices as Ma2Value[])),
          );
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
