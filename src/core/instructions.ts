import {BasicSyntaxError} from './diagnostic.ts';
import type {ParsedLine, SimpleStatement} from './types.ts';

export const maxLineStatements = 4096;

// A sequence may contain leaf statements only. Keep this list exhaustive when
// the public pre-1.0 statement union grows; malformed constructed trees fail.
const simpleKinds: Record<SimpleStatement['type'], true> = {
  DimStatement: true,
  LetStatement: true,
  InputStatement: true,
  IfStatement: true,
  GotoStatement: true,
  ForStatement: true,
  NextStatement: true,
  PrintStatement: true,
  PrintUsingStatement: true,
  RemStatement: true,
  WaitStatement: true,
  ColorStatement: true,
  PsetStatement: true,
  LineStatement: true,
  CircleStatement: true,
  ClsStatement: true,
  EndStatement: true,
};

export interface Instruction {
  readonly line: ParsedLine;
  readonly label: number;
  readonly ordinal: number;
  readonly statement: SimpleStatement;
  readonly nextLineIndex: number;
}

export function lineStatements(line: ParsedLine): readonly SimpleStatement[] {
  const sequence = line.statement;
  if (sequence.type !== 'StatementSequence') return [sequence];
  const fail = (code: string, message: string): never => {
    throw new BasicSyntaxError(code, message, sequence.location.start, line.label);
  };
  if (!Array.isArray(sequence.statements) || sequence.statements.length < 2)
    fail('INVALID_SEQUENCE', 'A statement sequence requires at least two statements');
  if (sequence.statements.length > maxLineStatements)
    fail('STATEMENT_LIMIT', `A line permits at most ${maxLineStatements} statements`);
  if (
    !Array.isArray(sequence.separators) ||
    sequence.separators.length !== sequence.statements.length - 1
  )
    fail('INVALID_SEQUENCE', 'A statement sequence requires one separator between statements');
  for (const statement of sequence.statements) {
    if (!statement || !Object.hasOwn(simpleKinds, statement.type))
      fail('INVALID_SEQUENCE', 'A sequence may contain only ordinary statements');
  }
  return sequence.statements;
}

/** Positions belong to the prepared snapshot, never to invented BASIC labels. */
export function programInstructions(lines: readonly ParsedLine[]): readonly Instruction[] {
  const instructions: Instruction[] = [];
  for (const line of lines) {
    const statements = lineStatements(line);
    const nextLineIndex = instructions.length + statements.length;
    statements.forEach((statement, ordinal) =>
      instructions.push(
        Object.freeze({
          line,
          label: line.label,
          ordinal,
          statement,
          nextLineIndex,
        }),
      ),
    );
  }
  return Object.freeze(instructions);
}
