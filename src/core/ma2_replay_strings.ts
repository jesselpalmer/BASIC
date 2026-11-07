import {basicPlusStringLength} from './basic_plus_strings.ts';
import {compareBasicPlusStringRelation} from './comparison.ts';
import {BasicSyntaxError} from './diagnostic.ts';
import type {readSelectedMa2Input} from './ma2_statement_input.ts';
import type {Comparison, Expression, Location, NodeOf} from './types.ts';

type InputValue = Extract<Awaited<ReturnType<typeof readSelectedMa2Input>>, {kind: 'value'}>;

function unsupported(message: string, location: Location): never {
  throw new BasicSyntaxError('UNSUPPORTED_MA2_STRING', message, location.start, location.label);
}

const shortStringName = /^[A-Z][0-9]?\$$/;

/** Execution-owned bounded string scalars for the selected source subset. */
export class SelectedMa2StringState {
  readonly #values = new Map<string, string>();

  reset(): void {
    this.#values.clear();
  }

  snapshot(): readonly Readonly<{name: string; value: string}>[] {
    return Object.freeze(Array.from(this.#values, ([name, value]) => Object.freeze({name, value})));
  }

  validateAssignment(statement: NodeOf<'LetStatement'>): void {
    const {target, expression} = statement;
    if (target.type !== 'Variable' || !shortStringName.test(target.name))
      unsupported('Selected string assignment requires a short scalar target', target.location);
    this.validateOperand(expression);
  }

  /** Validate the whole source before writes, then copy the current scalar value. */
  assignSource(statement: NodeOf<'LetStatement'>): void {
    this.validateAssignment(statement);
    const value = this.resolve(statement.expression);
    this.#validate(value, statement.expression.location);
    this.#values.set(statement.target.name, value);
  }

  /** The input boundary reads first; commit only a matching validated result. */
  commitInput(statement: NodeOf<'InputStatement'>, result: InputValue): void {
    if (
      !shortStringName.test(statement.target.name) ||
      result.target !== statement.target.name ||
      typeof result.value !== 'string'
    )
      unsupported('Expected a matching selected string input response', statement.target.location);
    this.#validate(result.value, statement.target.location);
    this.#values.set(statement.target.name, result.value);
  }

  validateOperand(expression: Expression): void {
    if (expression.type === 'StringLiteral') {
      this.#validate(expression.value, expression.location);
      return;
    }
    if (expression.type !== 'Variable' || !shortStringName.test(expression.name))
      unsupported('Expected a selected short string scalar or literal', expression.location);
  }

  resolve(expression: Expression): string {
    this.validateOperand(expression);
    if (expression.type === 'StringLiteral') return expression.value;
    if (expression.type !== 'Variable') throw Error('Validated string operand changed');
    // BASIC-PLUS §§2.5.2/3.6.2/5.1.2 read an unassigned string as empty.
    // Keep the default implicit so a read does not become a stored assignment.
    return this.#values.get(expression.name) ?? '';
  }

  validateReplay(condition: Comparison): void {
    if (condition.operator !== '=' && condition.operator !== '<>')
      unsupported('Selected string comparison requires = or <>', condition.location);
    this.validateOperand(condition.left);
    this.validateOperand(condition.right);
  }

  compareReplay(condition: Comparison): boolean {
    this.validateReplay(condition);
    const left = this.resolve(condition.left);
    const right = this.resolve(condition.right);
    // Equality and inequality accept the complete selected byte domain.
    const result = compareBasicPlusStringRelation(left, condition.operator, right);
    if (result.kind !== 'value') unsupported(result.reason, condition.location);
    return result.value;
  }

  #validate(value: string, location: Location): void {
    const result = basicPlusStringLength(value);
    if (result.kind !== 'value') unsupported(result.reason, location);
  }
}
