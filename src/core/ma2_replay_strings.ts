import {basicPlusStringLength} from './basic_plus_strings.ts';
import {compareBasicPlusStringRelation} from './comparison.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
import type {readSelectedMa2Input} from './ma2_statement_input.ts';
import type {Comparison, Expression, Location, NodeOf} from './types.ts';

type InputValue = Extract<Awaited<ReturnType<typeof readSelectedMa2Input>>, {kind: 'value'}>;

function unsupported(message: string, location: Location): never {
  throw new BasicSyntaxError('UNSUPPORTED_MA2_STRING', message, location.start, location.label);
}

/** Execution-owned literal image and replay state for the reviewed first-game subset. */
export class SelectedMa2StringState {
  readonly #values = new Map<string, string>();

  reset(): void {
    this.#values.clear();
  }

  snapshot(): readonly Readonly<{name: string; value: string}>[] {
    return Object.freeze(Array.from(this.#values, ([name, value]) => Object.freeze({name, value})));
  }

  /** The opening assigns the literal B$ image; other source string writes stay gated. */
  assignLiteral(statement: NodeOf<'LetStatement'>): void {
    const {target, expression} = statement;
    if (target.type !== 'Variable' || target.name !== 'B$' || expression.type !== 'StringLiteral')
      unsupported('Expected the reviewed literal B$ assignment', statement.location);
    this.#validate(expression.value, expression.location);
    this.#values.set(target.name, expression.value);
  }

  /** The input boundary reads first; commit only a matching validated A$ result. */
  commitInput(statement: NodeOf<'InputStatement'>, result: InputValue): void {
    if (
      statement.target.name !== 'A$' ||
      result.target !== 'A$' ||
      typeof result.value !== 'string'
    )
      unsupported('Expected a selected A$ input response', statement.target.location);
    this.#validate(result.value, statement.target.location);
    this.#values.set('A$', result.value);
  }

  resolve(expression: Expression): string {
    if (expression.type === 'StringLiteral') return expression.value;
    if (expression.type !== 'Variable' || (expression.name !== 'A$' && expression.name !== 'B$'))
      unsupported('Expected a selected string variable or literal', expression.location);
    const value = this.#values.get(expression.name);
    if (value === undefined)
      throw new BasicRuntimeError(
        'UNBOUND_MA2_STRING',
        `String ${expression.name} is unbound`,
        expression.location.start,
        expression.location.label,
      );
    return value;
  }

  validateReplay(condition: Comparison): void {
    if (
      condition.operator !== '=' ||
      condition.left.type !== 'Variable' ||
      condition.left.name !== 'A$' ||
      condition.right.type !== 'StringLiteral' ||
      (condition.right.value !== 'YES' && condition.right.value !== 'NO')
    )
      unsupported('Expected the reviewed A$ YES/NO comparison', condition.location);
  }

  compareReplay(condition: Comparison): boolean {
    this.validateReplay(condition);
    const left = this.resolve(condition.left);
    const right = this.resolve(condition.right);
    // Both operands were validated on entry and replay accepts only equality;
    // the shared predicate's unsupported ordering/byte cases cannot occur here.
    const result = compareBasicPlusStringRelation(left, condition.operator, right) as Readonly<{
      kind: 'value';
      value: boolean;
    }>;
    return result.value;
  }

  #validate(value: string, location: Location): void {
    const result = basicPlusStringLength(value);
    if (result.kind !== 'value') unsupported(result.reason, location);
  }
}
