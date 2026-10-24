import {BasicRuntimeError} from './diagnostic.ts';
import type {Evaluator} from './evaluator.ts';
import {containsLoopBody} from './loops.ts';
import type {LoopPair} from './loops.ts';
import type {PreparedProgram} from './prepared_program.ts';
import type {Expression, Location, NodeOf, ParsedLine} from './types.ts';

interface LoopFrame extends LoopPair {
  readonly limit: number;
  readonly step: number;
}

/** The cursor and active loops belong to one execution of a prepared snapshot. */
export class ControlFlow {
  #index = 0;
  #loopFrames = new Map<number, LoopFrame>();

  constructor(
    private readonly prepared: PreparedProgram,
    private readonly evaluator: Evaluator,
  ) {}

  get nextLine(): ParsedLine | undefined {
    return this.prepared.program.lines[this.#index];
  }

  takeLine(): ParsedLine | undefined {
    const line = this.nextLine;
    if (line) this.#index++;
    return line;
  }

  clearLoops(): void {
    this.#loopFrames.clear();
  }

  jump(label: number, location: Location): void {
    const index = this.prepared.labelIndices.get(label);
    if (index === undefined) {
      throw new BasicRuntimeError(
        'MISSING_TARGET',
        `No line label ${label}`,
        location.start,
        location.label,
      );
    }
    this.#moveTo(index, location);
  }

  beginLoop(statement: NodeOf<'ForStatement'>): void {
    for (const frame of this.#loopFrames.values()) {
      if (frame.variable === statement.variable.name) {
        throw new BasicRuntimeError(
          'LOOP_VARIABLE_ACTIVE',
          `Loop variable ${frame.variable} is already active`,
          statement.variable.location.start,
          statement.location.label,
        );
      }
    }
    const start = this.#loopNumber(statement.start);
    const limit = this.#loopNumber(statement.end);
    const step = statement.step === null ? 1 : this.#loopNumber(statement.step);
    if (step === 0) {
      throw new BasicRuntimeError(
        'ZERO_STEP',
        'FOR STEP must not be zero',
        statement.step!.location.start,
        statement.location.label,
      );
    }
    this.evaluator.assign(statement.variable, start);
    // takeLine advances before dispatch, so the current header is index - 1.
    const pair = this.prepared.pairsByFor.get(this.#index - 1)!;
    if (step > 0 ? start > limit : start < limit)
      this.#moveTo(pair.nextIndex + 1, statement.location);
    else this.#loopFrames.set(pair.forIndex, {...pair, limit, step});
  }

  nextLoop(statement: NodeOf<'NextStatement'>): void {
    const pair = this.prepared.pairsByNext.get(this.#index - 1)!;
    const frame = this.#loopFrames.get(pair.forIndex);
    if (!frame) {
      throw new BasicRuntimeError(
        'LOOP_NOT_ACTIVE',
        `FOR loop for ${pair.variable} is not active`,
        statement.location.start,
        statement.location.label,
      );
    }
    const current = this.#loopNumber(statement.variable);
    const value = current + frame.step;
    if (!Number.isFinite(value)) {
      throw new BasicRuntimeError(
        'NON_FINITE_NUMBER',
        'Loop increment must be finite',
        statement.variable.location.start,
        statement.location.label,
      );
    }
    this.evaluator.assign(statement.variable, value);
    if (frame.step > 0 ? value <= frame.limit : value >= frame.limit)
      this.#moveTo(frame.forIndex + 1, statement.location);
    else this.#loopFrames.delete(frame.forIndex);
  }

  #moveTo(index: number, location: Location): void {
    for (const pair of this.prepared.loopPairs) {
      if (containsLoopBody(pair, index) && !this.#loopFrames.has(pair.forIndex)) {
        throw new BasicRuntimeError(
          'LOOP_ENTRY',
          `Cannot enter inactive FOR loop for ${pair.variable}`,
          location.start,
          location.label,
        );
      }
    }
    for (const [key, frame] of this.#loopFrames) {
      if (!containsLoopBody(frame, index)) this.#loopFrames.delete(key);
    }
    this.#index = index;
  }

  #loopNumber(expression: Expression): number {
    const value = this.evaluator.evaluate(expression);
    if (typeof value !== 'number') {
      throw new BasicRuntimeError(
        'TYPE_MISMATCH',
        'Loop values must be numbers',
        expression.location.start,
        expression.location.label,
      );
    }
    return value;
  }
}
