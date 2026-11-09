import {parseProgram, validateProgram} from '../parser/parser.ts';
import {pairLoops} from './loops.ts';
import {validateDialect} from './dialect.ts';
import {arrayDeclarations} from './array_declarations.ts';
import {programInstructions} from './instructions.ts';
import {dataItems} from './data.ts';
import {sameTree} from '../parser/canonical_tree.ts';
import {preflightBasicPlusMa2Candidate} from '../parser/ma2_candidate_support.ts';
import type {Instruction} from './instructions.ts';
import type {LoopPair} from './loops.ts';
import type {ArrayDeclaration, Dialect, ParsedLine, Program} from './types.ts';

/** A snapshot and its derived lookup tables always travel together. */
export interface PreparedProgram {
  readonly program: Program;
  readonly instructions: readonly Instruction[];
  readonly arrayDeclarations: readonly ArrayDeclaration[];
  readonly dataItems: ReturnType<typeof dataItems>;
  readonly labelIndices: ReadonlyMap<number, number>;
  readonly loopPairs: readonly LoopPair[];
  readonly pairsByFor: ReadonlyMap<number, LoopPair>;
  readonly pairsByNext: ReadonlyMap<number, LoopPair>;
}

export type PreparedMa2Candidate = Pick<
  PreparedProgram,
  'instructions' | 'labelIndices' | 'loopPairs' | 'pairsByFor' | 'pairsByNext'
> & {
  readonly source: string;
  readonly lines: readonly ParsedLine[];
  readonly arrayDeclarations: readonly ArrayDeclaration[];
};

// A nominal, source-bound internal Program transport. No caller-owned tree or
// derived index is trusted when this is installed into an execution.
const selectedProgramBrand: unique symbol = Symbol('selected-ma2-program');
const selectedPrograms = new WeakSet<object>();
export type InternalSelectedProgram = Readonly<{
  readonly kind: 'selected-ma2-program';
  readonly source: string;
  readonly lines: readonly ParsedLine[];
  readonly [selectedProgramBrand]: true;
}>;

/** Prepare an internal selected Program without declaring a public dialect. */
export function prepareInternalSelectedProgram(
  source: string,
  supplied?: readonly ParsedLine[],
): InternalSelectedProgram {
  const candidate = prepareSelectedMa2Candidate(source, supplied);
  const program = Object.freeze({
    kind: 'selected-ma2-program' as const,
    source: candidate.source,
    lines: candidate.lines,
    [selectedProgramBrand]: true as const,
  });
  selectedPrograms.add(program);
  return program;
}

export function isInternalSelectedProgram(value: unknown): value is InternalSelectedProgram {
  return value !== null && typeof value === 'object' && selectedPrograms.has(value);
}

function instructionTables(
  instructions: readonly Instruction[],
  loopPairs: readonly LoopPair[] = pairLoops(instructions),
) {
  return {
    instructions,
    labelIndices: new Map(
      instructions.flatMap((instruction, index) =>
        instruction.ordinal === 0 ? [[instruction.label, index] as const] : [],
      ),
    ),
    loopPairs,
    pairsByFor: new Map(loopPairs.map((pair) => [pair.forIndex, pair])),
    pairsByNext: new Map(loopPairs.map((pair) => [pair.nextIndex, pair])),
  };
}

/** Internal source-bound preparation; no public historical Program is created. */
export function prepareSelectedMa2Candidate(
  source: string,
  supplied?: readonly ParsedLine[],
): PreparedMa2Candidate {
  const candidate = preflightBasicPlusMa2Candidate(source, supplied);
  return Object.freeze({
    source: candidate.source,
    lines: candidate.lines,
    arrayDeclarations: candidate.arrayDeclarations,
    ...instructionTables(candidate.instructions, candidate.loopPairs),
  });
}

export function prepareProgram(source: string | Program, dialect: Dialect): PreparedProgram {
  if (dialect === 'basic-plus-v4a12-ma2')
    throw new TypeError('Expected a shared-driver BASIC dialect');
  let program: Program;
  if (typeof source === 'string') program = parseProgram(source, {dialect});
  else {
    validateDialect(source.dialect, dialect);
    if (dialect !== 'native') {
      if (source.type !== 'Program' || typeof source.source !== 'string')
        throw new TypeError(
          `${dialect === 'edusystem-30' ? 'EDUSYSTEM-30' : 'Altair'} Program requires exact source`,
        );
      program = parseProgram(source.source, {dialect});
      if (!sameTree(program.lines, source.lines))
        throw new TypeError(
          `Supplied ${dialect === 'edusystem-30' ? 'EDUSYSTEM-30' : 'Altair'} Program disagrees with its source`,
        );
    } else program = validateProgram(source.lines, {dialect});
  }
  const instructions = programInstructions(program.lines);
  return {
    program,
    ...instructionTables(instructions),
    arrayDeclarations: arrayDeclarations(program.lines),
    dataItems: dataItems(program.lines),
  };
}
