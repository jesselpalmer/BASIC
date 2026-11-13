import {BasicRuntimeError} from './diagnostic.ts';
import {
  eduSystem30FromNumber,
  evaluateEduSystem30Arithmetic,
  observeEduSystem30,
  type EduSystem30FloatingValue,
} from './edusystem30_floating.ts';
import {containsLoopBody} from './loops.ts';
import type {LoopPair} from './loops.ts';
import type {PreparedProgram} from './prepared_program.ts';
import type {Expression, Location, NodeOf} from './types.ts';
import type {Instruction} from './instructions.ts';

interface LoopFrame extends LoopPair {
  readonly limit: number;
  readonly step: number;
  remainingEduSystem30Steps: number | null;
}

interface CallFrame {
  readonly index: number;
  readonly loops: Map<number, LoopFrame>;
}

const maxCallDepth = 1024;

/** Numeric loop operations belong to the selected value policy. */
export interface LoopValues {
  evaluate(expression: Expression): number | string;
  assign(target: NodeOf<'Variable'>, value: number): void;
  /** Optional selected-domain check before NEXT uses an increment for control flow. */
  validateIncrement?(value: number, location: Location): void;
}

/** Selected loop observations retain the value present at terminating NEXT. */
export type LoopPolicy = 'native' | 'selected-ma2' | 'selected-edu30';

type FlowProgram = Pick<
  PreparedProgram,
  'instructions' | 'labelIndices' | 'loopPairs' | 'pairsByFor' | 'pairsByNext'
>;

function eduSystem30LoopValue(
  evaluate: () => EduSystem30FloatingValue,
  location: Location,
): number {
  try {
    const value = observeEduSystem30(evaluate());
    if (Number.isFinite(value)) return value;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  throw new BasicRuntimeError(
    'NON_FINITE_NUMBER',
    'EDUSYSTEM-30 loop value exceeds its supported range',
    location.start,
    location.label,
  );
}

/** The cursor and active loops belong to one execution of a prepared snapshot. */
export class ControlFlow {
  #index = 0;
  #currentIndex = -1;
  #explicitTransfer = false;
  #loopFrames = new Map<number, LoopFrame>();
  #calls: CallFrame[] = [];
  // Native and MA2 require unique active variables across suspended contexts.
  #activeLoopVariables = new Set<string>();

  constructor(
    private readonly prepared: FlowProgram,
    private readonly evaluator: LoopValues,
    private readonly loopPolicy: LoopPolicy = 'native',
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

  call(target: NodeOf<'NumberLiteral'>, location: Location): void {
    const index = this.#target(target.value, target.location);
    if (this.#calls.length === maxCallDepth) {
      throw new BasicRuntimeError(
        'CALL_STACK_LIMIT',
        `At most ${maxCallDepth} GOSUB calls may be active`,
        location.start,
        location.label,
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
    const name = statement.variable.name;
    const uniqueVariables = this.loopPolicy !== 'selected-edu30';
    if (uniqueVariables && this.#activeLoopVariables.has(name)) {
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
    const skip = step > 0 ? start > limit : start < limit;
    // The visible scalar can round away an increment or be changed by LET.
    // The archived loop's separate countdown starts with a stored quotient.
    const remainingEduSystem30Steps =
      !skip && this.loopPolicy === 'selected-edu30'
        ? eduSystem30LoopValue(() => {
            const difference = evaluateEduSystem30Arithmetic(
              '-',
              eduSystem30FromNumber(limit),
              eduSystem30FromNumber(start),
            );
            return evaluateEduSystem30Arithmetic('/', difference, eduSystem30FromNumber(step));
          }, statement.location)
        : null;
    this.evaluator.assign(statement.variable, start);
    // The actual header position is independent of its prepared successor.
    const pair = this.prepared.pairsByFor.get(this.#currentIndex)!;
    if (skip) {
      // EDU30 can restart an initialized header with bounds that now skip it.
      this.#loopFrames.delete(pair.forIndex);
      this.#moveTo(pair.nextIndex + 1, statement.location);
    } else {
      this.#loopFrames.set(pair.forIndex, {
        ...pair,
        limit,
        step,
        remainingEduSystem30Steps,
      });
      if (uniqueVariables) this.#activeLoopVariables.add(name);
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
    const remaining = frame.remainingEduSystem30Steps;
    if (remaining === null || remaining >= 1) {
      const current = this.#loopNumber(statement.variable);
      const location = statement.variable.location;
      const value =
        remaining === null
          ? current + frame.step
          : eduSystem30LoopValue(
              () =>
                evaluateEduSystem30Arithmetic(
                  '+',
                  eduSystem30FromNumber(current),
                  eduSystem30FromNumber(frame.step),
                ),
              location,
            );
      if (!Number.isFinite(value))
        throw new BasicRuntimeError(
          'NON_FINITE_NUMBER',
          'Loop increment must be finite',
          location.start,
          location.label,
        );
      this.evaluator.validateIncrement?.(value, location);
      if (remaining !== null || (frame.step > 0 ? value <= frame.limit : value >= frame.limit)) {
        if (remaining !== null) frame.remainingEduSystem30Steps = remaining - 1;
        this.evaluator.assign(statement.variable, value);
        this.#moveTo(frame.forIndex + 1, statement.location);
        return;
      }
      if (this.loopPolicy === 'native') this.evaluator.assign(statement.variable, value);
    }
    this.#loopFrames.delete(frame.forIndex);
    this.#activeLoopVariables.delete(frame.variable);
  }

  #moveTo(index: number, location: Location): void {
    this.#checkDestination(index, location, this.#loopFrames);
    // The selected references retain initialized loops across transfers.
    // Native drops an exited frame immediately.
    if (this.loopPolicy === 'native') {
      for (const [key, frame] of this.#loopFrames) {
        if (!containsLoopBody(frame, index)) {
          this.#loopFrames.delete(key);
          this.#activeLoopVariables.delete(frame.variable);
        }
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
    // EDU30 allows transfers into a lexical FOR body without running its header.
    if (this.loopPolicy === 'selected-edu30') return;
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
