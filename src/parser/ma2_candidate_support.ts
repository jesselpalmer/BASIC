import {BasicSyntaxError} from '../core/diagnostic.ts';
import type {SimpleStatement} from '../core/types.ts';
import {validateBasicPlusMa2Candidate} from './ma2_candidate_validation.ts';

// Accepted syntax is deliberately narrower than the shared native AST. This
// gate checks every instruction, including unreachable lines, before a future
// statement executor can take ownership of a candidate.
const candidateStatements = new Set<SimpleStatement['type']>([
  'DimStatement',
  'LetStatement',
  'InputStatement',
  'IfStatement',
  'GotoStatement',
  'ForStatement',
  'NextStatement',
  'PrintStatement',
  'PrintUsingStatement',
  'RemStatement',
  'EndStatement',
]);

/** Internal first-game statement-form preflight; semantic support is separate. */
export function preflightBasicPlusMa2Candidate(source: string) {
  const candidate = validateBasicPlusMa2Candidate(source);
  for (const {statement} of candidate.instructions) {
    if (!candidateStatements.has(statement.type))
      throw new BasicSyntaxError(
        'UNSUPPORTED_MA2_STATEMENT',
        `Selected MA2 candidate does not support ${statement.type}`,
        statement.location.start,
        statement.location.label,
      );
  }
  return candidate;
}
