import {parseProgram, validateProgram} from '../parser/parser.ts';
import {pairLoops} from './loops.ts';
import {validateDialect} from './dialect.ts';
import {arrayDeclarations} from './array_declarations.ts';
import type {LoopPair} from './loops.ts';
import type {ArrayDeclaration, Dialect, Program} from './types.ts';

/** A snapshot and its derived lookup tables always travel together. */
export interface PreparedProgram {
  readonly program: Program;
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
  const loopPairs = pairLoops(program.lines);
  return {
    program,
    arrayDeclarations: arrayDeclarations(program.lines),
    labelIndices: new Map(program.lines.map((line, index) => [line.label, index])),
    loopPairs,
    pairsByFor: new Map(loopPairs.map((pair) => [pair.forIndex, pair])),
    pairsByNext: new Map(loopPairs.map((pair) => [pair.nextIndex, pair])),
  };
}
