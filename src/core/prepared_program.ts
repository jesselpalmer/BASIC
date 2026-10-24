import {parseProgram, validateProgram} from '../parser/parser.ts';
import {pairLoops} from './loops.ts';
import type {LoopPair} from './loops.ts';
import type {Program} from './types.ts';

/** A snapshot and its derived lookup tables always travel together. */
export interface PreparedProgram {
  readonly program: Program;
  readonly labelIndices: ReadonlyMap<number, number>;
  readonly loopPairs: readonly LoopPair[];
  readonly pairsByFor: ReadonlyMap<number, LoopPair>;
  readonly pairsByNext: ReadonlyMap<number, LoopPair>;
}

export function prepareProgram(source: string | Program): PreparedProgram {
  const program = typeof source === 'string' ? parseProgram(source) : validateProgram(source.lines);
  const loopPairs = pairLoops(program.lines);
  return {
    program,
    labelIndices: new Map(program.lines.map((line, index) => [line.label, index])),
    loopPairs,
    pairsByFor: new Map(loopPairs.map((pair) => [pair.forIndex, pair])),
    pairsByNext: new Map(loopPairs.map((pair) => [pair.nextIndex, pair])),
  };
}
