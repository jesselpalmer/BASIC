import {parseProgram, validateProgram} from '../parser/parser.ts';
import {pairLoops} from './loops.ts';
import {validateDialect} from './dialect.ts';
import {arrayDeclarations} from './array_declarations.ts';
import {programInstructions} from './instructions.ts';
import {dataItems} from './data.ts';
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
};

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
    ...instructionTables(candidate.instructions, candidate.loopPairs),
  });
}

export function prepareProgram(source: string | Program, dialect: Dialect): PreparedProgram {
  if (typeof source !== 'string') validateDialect(source.dialect, dialect);
  const program =
    typeof source === 'string'
      ? parseProgram(source, {dialect})
      : validateProgram(source.lines, {dialect});
  const instructions = programInstructions(program.lines);
  return {
    program,
    ...instructionTables(instructions),
    arrayDeclarations: arrayDeclarations(program.lines),
    dataItems: dataItems(program.lines),
  };
}
