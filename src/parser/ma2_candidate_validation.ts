import {BasicSyntaxError} from '../core/diagnostic.ts';
import {selectedMa2ArrayDeclarations, validateArrays} from '../core/array_declarations.ts';
import {programInstructions} from '../core/instructions.ts';
import {pairLoops} from '../core/loops.ts';
import type {Dialect, ParsedLine} from '../core/types.ts';
import {freezeTree} from './program_validation.ts';
import {parseBasicPlusMa2Candidate} from './parser.ts';
import {sameTree} from './canonical_tree.ts';

/** Internal syntax snapshot; this does not authorize any statement to execute. */
export function validateBasicPlusMa2Candidate(
  source: string,
  supplied?: readonly ParsedLine[],
  dialect: Dialect = 'native',
) {
  if (typeof source !== 'string') throw new TypeError('Expected candidate source');
  // Reparse the exact source rather than trusting caller-owned word values,
  // locations, descendants or dialect metadata. The resulting tree is detached.
  const lines = parseBasicPlusMa2Candidate(source, dialect);
  if (supplied !== undefined && !sameTree(lines, supplied))
    throw new TypeError('Supplied candidate tree disagrees with its source');

  const labels = new Set<number>();
  for (const line of lines) {
    if (labels.has(line.label))
      throw new BasicSyntaxError(
        'DUPLICATE_LABEL',
        `Duplicate line label ${line.label}`,
        line.location.start,
        line.label,
      );
    labels.add(line.label);
  }
  const instructions = programInstructions(lines);
  for (const {statement} of instructions) {
    const targets =
      statement.type === 'GotoStatement' || statement.type === 'IfStatement'
        ? [statement.target]
        : statement.type === 'InlineIfStatement'
          ? [statement.consequent, statement.alternate].filter(
              (node) => node?.type === 'NumberLiteral',
            )
          : [];
    for (const target of targets) {
      if (target?.type === 'NumberLiteral' && !labels.has(target.value))
        throw new BasicSyntaxError(
          'MISSING_TARGET',
          `No line label ${target.value}`,
          target.location.start,
          statement.location.label,
        );
    }
  }
  const loopPairs = pairLoops(instructions);
  const arrayDeclarations = selectedMa2ArrayDeclarations(lines);
  validateArrays(lines, arrayDeclarations);
  return freezeTree({
    kind: 'ma2-candidate-syntax' as const,
    source,
    lines,
    instructions,
    loopPairs,
    arrayDeclarations,
  });
}
