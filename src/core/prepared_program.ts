import {parseProgram, validateProgram} from '../parser/parser.ts';
import {pairLoops} from './loops.ts';
import {validateDialect} from './dialect.ts';
import {arrayDeclarations} from './array_declarations.ts';
import {programInstructions} from './instructions.ts';
import type {Instruction} from './instructions.ts';
import type {LoopPair} from './loops.ts';
import type {ArrayDeclaration, Dialect, Program} from './types.ts';

/** A snapshot and its derived lookup tables always travel together. */
export interface PreparedProgram {
  readonly program: Program;
  readonly instructions: readonly Instruction[];
  readonly arrayDeclarations: readonly ArrayDeclaration[];
  readonly labelIndices: ReadonlyMap<number, number>;
  readonly loopPairs: readonly LoopPair[];
  readonly pairsByFor: ReadonlyMap<number, LoopPair>;
  readonly pairsByNext: ReadonlyMap<number, LoopPair>;
}

export function prepareProgram(source: string | Program, dialect: Dialect): PreparedProgram {
  if (typeof source !== 'string') validateDialect(source.dialect, dialect);
  const program =
    typeof source === 'string'
      ? parseProgram(source, {dialect})
      : validateProgram(source.lines, {dialect});
  const instructions = programInstructions(program.lines);
  const loopPairs = pairLoops(instructions);
  return {
    program,
    instructions,
    arrayDeclarations: arrayDeclarations(program.lines),
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
