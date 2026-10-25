import {BasicRuntimeError} from './diagnostic.ts';
import type {Evaluator} from './evaluator.ts';
import {containsLoopBody} from './loops.ts';
import type {LoopPair} from './loops.ts';
import type {PreparedProgram} from './prepared_program.ts';
import type {Expression, Location, NodeOf} from './types.ts';
import type {Instruction} from './instructions.ts';

interface LoopFrame extends LoopPair {
  readonly limit: number;
  readonly step: number;
}

interface CallFrame {
  readonly index: number;
  readonly loops: Map<number, LoopFrame>;
}

const maxCallDepth = 1024;

/** The cursor and active loops belong to one execution of a prepared snapshot. */
export class ControlFlow {
  #index = 0;
  #currentIndex = -1;
  #explicitTransfer = false;
  #loopFrames = new Map<number, LoopFrame>();
  #calls: CallFrame[] = [];
  // Unique across current and suspended contexts, like the shared BASIC values.
  #activeLoopVariables = new Set<string>();

  constructor(
    private readonly prepared: PreparedProgram,
    private readonly evaluator: Evaluator,
  ) {}

  get nextInstruction(): Instruction | undefined {
    return this.prepared.instructions[this.#index];
  }

  takeInstruction(): Instruction | undefined {
    const line = this.nextInstruction;
    if (line) {
      this.#currentIndex = this.#index;
      this.#index = line.nextIndex;
      this.#explicitTransfer = false;
    }
    return line;
  }

  clearFrames(): void {
    this.#loopFrames.clear();
    this.#calls.length = 0;
    this.#activeLoopVariables.clear();
  }

  skipLine(location: Location): void {
    this.#moveTo(this.prepared.instructions[this.#currentIndex].nextLineIndex, location);
  }

  chooseBranch(taken: boolean, location: Location): void {
    const branches = this.prepared.instructions[this.#currentIndex].branches!;
    const destination = taken ? branches.whenTrue : branches.whenFalse;
    this.#moveTo(
      destination.kind === 'label'
        ? this.#target(destination.target.value, destination.target.location)
        : destination.index,
      destination.kind === 'label' ? destination.target.location : location,
    );
  }

  finishInstruction(): void {
    const instruction = this.prepared.instructions[this.#currentIndex];
    if (!this.#explicitTransfer && instruction.nextIndex !== this.#currentIndex + 1)
      this.#moveTo(instruction.nextIndex, instruction.statement.location);
  }

  jump(label: number, location: Location): void {
    this.#moveTo(this.#target(label, location), location);
  }

  call(statement: NodeOf<'GosubStatement'>): void {
    const {target} = statement;
    const index = this.#target(target.value, target.location);
    if (this.#calls.length === maxCallDepth) {
      throw new BasicRuntimeError(
        'CALL_STACK_LIMIT',
        `At most ${maxCallDepth} GOSUB calls may be active`,
        statement.location.start,
        statement.location.label,
      );
    }
    const loops = new Map<number, LoopFrame>();
    this.#checkDestination(index, target.location, loops);
    // The driver already advanced to the real following instruction. Suspend
    // this map without copying or discarding the caller's live loop frames.
    this.#calls.push({index: this.#index, loops: this.#loopFrames});
    this.#loopFrames = loops;
    this.#index = index;
    this.#explicitTransfer = true;
  }

  returnFromCall(location: Location): void {
    const frame = this.#calls.pop();
    if (!frame) {
      throw new BasicRuntimeError(
        'RETURN_WITHOUT_GOSUB',
        'RETURN has no active GOSUB',
        location.start,
        location.label,
      );
    }
    for (const loop of this.#loopFrames.values()) this.#activeLoopVariables.delete(loop.variable);
    this.#loopFrames.clear();
    this.#loopFrames = frame.loops;
    this.#moveTo(frame.index, location);
  }

  #target(label: number, location: Location): number {
    const index = this.prepared.labelIndices.get(label);
    if (index === undefined) {
      throw new BasicRuntimeError(
        'MISSING_TARGET',
        `No line label ${label}`,
        location.start,
        location.label,
      );
    }
    return index;
  }

  beginLoop(statement: NodeOf<'ForStatement'>): void {
    if (this.#activeLoopVariables.has(statement.variable.name)) {
      throw new BasicRuntimeError(
        'LOOP_VARIABLE_ACTIVE',
        `Loop variable ${statement.variable.name} is already active`,
        statement.variable.location.start,
        statement.location.label,
      );
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
    // The actual header position is independent of its prepared successor.
    const pair = this.prepared.pairsByFor.get(this.#currentIndex)!;
    if (step > 0 ? start > limit : start < limit)
      this.#moveTo(pair.nextIndex + 1, statement.location);
    else {
      this.#loopFrames.set(pair.forIndex, {...pair, limit, step});
      this.#activeLoopVariables.add(statement.variable.name);
    }
  }

  nextLoop(statement: NodeOf<'NextStatement'>): void {
    const pair = this.prepared.pairsByNext.get(this.#currentIndex)!;
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
    else {
      this.#loopFrames.delete(frame.forIndex);
      this.#activeLoopVariables.delete(frame.variable);
    }
  }

  #moveTo(index: number, location: Location): void {
    this.#checkDestination(index, location, this.#loopFrames);
    for (const [key, frame] of this.#loopFrames) {
      if (!containsLoopBody(frame, index)) {
        this.#loopFrames.delete(key);
        this.#activeLoopVariables.delete(frame.variable);
      }
    }
    this.#index = index;
    this.#explicitTransfer = true;
  }

  #checkDestination(
    index: number,
    location: Location,
    frames: ReadonlyMap<number, LoopFrame>,
  ): void {
    for (const pair of this.prepared.loopPairs) {
      if (containsLoopBody(pair, index) && !frames.has(pair.forIndex)) {
        throw new BasicRuntimeError(
          'LOOP_ENTRY',
          `Cannot enter inactive FOR loop for ${pair.variable}`,
          location.start,
          location.label,
        );
      }
    }
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
