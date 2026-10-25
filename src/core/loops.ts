import {BasicSyntaxError} from './diagnostic.ts';
import type {Instruction} from './instructions.ts';

export interface LoopPair {
  readonly forIndex: number;
  readonly nextIndex: number;
  readonly variable: string;
}

/** Pair lexical structures in numeric program order, without executing values. */
export function pairLoops(lines: readonly Instruction[]): LoopPair[] {
  const stack: number[] = [];
  const pairs: LoopPair[] = [];
  for (let index = 0; index < lines.length; index++) {
    const statement = lines[index].statement;
    if (statement.type === 'ForStatement') stack.push(index);
    else if (statement.type === 'NextStatement') {
      const forIndex = stack.pop();
      if (forIndex === undefined) {
        throw new BasicSyntaxError(
          'UNMATCHED_NEXT',
          'NEXT has no matching FOR',
          statement.location.start,
          statement.location.label,
        );
      }
      const header = lines[forIndex].statement;
      if (header.type !== 'ForStatement') throw new TypeError('Expected a FOR header');
      if (header.variable.name !== statement.variable.name) {
        throw new BasicSyntaxError(
          'MISMATCHED_NEXT',
          `Expected NEXT ${header.variable.name}, got ${statement.variable.name}`,
          statement.variable.location.start,
          statement.location.label,
        );
      }
      pairs.push({forIndex, nextIndex: index, variable: header.variable.name});
    }
  }
  if (stack.length) {
    const header = lines[stack.at(-1)!].statement;
    throw new BasicSyntaxError(
      'MISSING_NEXT',
      'FOR has no matching NEXT',
      header.location.start,
      header.location.label,
    );
  }
  return pairs.sort((a, b) => a.forIndex - b.forIndex);
}

export function containsLoopBody(pair: LoopPair, index: number): boolean {
  return pair.forIndex < index && index <= pair.nextIndex;
}
