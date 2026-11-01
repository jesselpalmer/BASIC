import {BasicSyntaxError} from './diagnostic.ts';
import type {ParsedLine, SimpleStatement, NodeOf, Location} from './types.ts';

export const maxLineStatements = 4096;
export const maxConditionalDepth = 128;

export function inlineBodyAllowed(statement: SimpleStatement): boolean {
  return !['DimStatement', 'DataStatement', 'ForStatement', 'NextStatement'].includes(
    statement.type,
  );
}

// A sequence contains ordinary statements, including structured inline IF.
// Keep this list exhaustive when
// the public pre-1.0 statement union grows; malformed constructed trees fail.
const simpleKinds: Record<SimpleStatement['type'], true> = {
  DimStatement: true,
  LetStatement: true,
  InputStatement: true,
  InputTargetsStatement: true,
  InputLineStatement: true,
  IfStatement: true,
  InlineIfStatement: true,
  GotoStatement: true,
  GosubStatement: true,
  OnStatement: true,
  ReturnStatement: true,
  DataStatement: true,
  ReadStatement: true,
  RestoreStatement: true,
  ChangeStatement: true,
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
  readonly nextIndex: number;
  readonly branches: Readonly<{whenTrue: Destination; whenFalse: Destination}> | null;
}

export type Destination =
  | {readonly kind: 'index'; readonly index: number}
  | {readonly kind: 'label'; readonly target: NodeOf<'NumberLiteral'>};

function lineRoots(line: ParsedLine): readonly SimpleStatement[] {
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

/** Every executable condition/body is visited, including dead branches. */
export function lineStatements(line: ParsedLine): readonly SimpleStatement[] {
  const pending = lineRoots(line)
    .toReversed()
    .map((statement) => ({statement, depth: 0, body: false}));
  const statements: SimpleStatement[] = [];
  function fail(
    code: string,
    message: string,
    location: Location = line.statement.location,
  ): never {
    throw new BasicSyntaxError(code, message, location.start, line.label);
  }
  while (pending.length) {
    const {statement, depth, body} = pending.pop()!;
    if (!statement || !Object.hasOwn(simpleKinds, statement.type))
      fail(body ? 'INVALID_CONDITIONAL' : 'INVALID_SEQUENCE', 'Expected an ordinary statement');
    if (body && !inlineBodyAllowed(statement))
      fail(
        'UNSUPPORTED_BRANCH',
        'DIM, DATA, FOR and NEXT are unsupported as inline branch bodies',
        statement.location,
      );
    if (statements.length === maxLineStatements)
      fail('STATEMENT_LIMIT', `A line permits at most ${maxLineStatements} statements`);
    statements.push(statement);
    if (
      (statement.type === 'IfStatement' || statement.type === 'InlineIfStatement') &&
      depth >= maxConditionalDepth
    )
      fail(
        'CONDITIONAL_LIMIT',
        `Conditional nesting exceeds ${maxConditionalDepth}`,
        statement.location,
      );
    if (statement.type !== 'InlineIfStatement') continue;
    const branches = [statement.consequent, statement.alternate];
    for (let i = branches.length - 1; i >= 0; i--) {
      const branch = branches[i];
      if (i === 1 && branch === null) continue;
      if (!branch) fail('INVALID_CONDITIONAL', 'Expected a conditional branch', statement.location);
      if (branch.type === 'NumberLiteral') {
        if (
          !Number.isSafeInteger(branch.value) ||
          branch.value < 1 ||
          branch.value > 65535 ||
          typeof branch.raw !== 'string' ||
          !/^\d+$/.test(branch.raw) ||
          Number(branch.raw) !== branch.value
        )
          fail('INVALID_TARGET', 'Expected a literal label from 1 through 65535', branch.location);
      } else pending.push({statement: branch, depth: depth + 1, body: true});
    }
  }
  return statements;
}

/** Positions belong to the prepared snapshot, never to invented BASIC labels. */
export function programInstructions(lines: readonly ParsedLine[]): readonly Instruction[] {
  const instructions: Instruction[] = [];
  for (const line of lines) {
    const statements = lineStatements(line);
    const base = instructions.length;
    const nextLineIndex = base + statements.length;
    const sizes = new Map<SimpleStatement, number>();
    const size = (branch: SimpleStatement | NodeOf<'NumberLiteral'> | null): number =>
      !branch || branch.type === 'NumberLiteral' ? 0 : sizes.get(branch)!;
    for (const statement of statements.toReversed())
      sizes.set(
        statement,
        statement.type === 'InlineIfStatement'
          ? 1 + size(statement.consequent) + size(statement.alternate)
          : 1,
      );
    const pending: {statement: SimpleStatement; index: number; next: number}[] = [];
    let start = base;
    for (const statement of lineRoots(line)) {
      const next = start + sizes.get(statement)!;
      pending.push({statement, index: start, next});
      start = next;
    }
    while (pending.length) {
      const {statement, index, next} = pending.pop()!;
      let branches: Instruction['branches'] = null;
      if (statement.type === 'InlineIfStatement') {
        const thenIndex = index + 1,
          elseIndex = thenIndex + size(statement.consequent);
        const destination = (
          branch: SimpleStatement | NodeOf<'NumberLiteral'> | null,
          position: number,
        ): Destination =>
          Object.freeze(
            branch?.type === 'NumberLiteral'
              ? {kind: 'label', target: branch}
              : {kind: 'index', index: branch ? position : nextLineIndex},
          );
        branches = Object.freeze({
          whenTrue: destination(statement.consequent, thenIndex),
          whenFalse: destination(statement.alternate, elseIndex),
        });
        if (statement.consequent.type !== 'NumberLiteral')
          pending.push({
            statement: statement.consequent,
            index: thenIndex,
            next: statement.alternate === null ? next : nextLineIndex,
          });
        if (statement.alternate && statement.alternate.type !== 'NumberLiteral')
          pending.push({statement: statement.alternate, index: elseIndex, next});
      }
      instructions[index] = Object.freeze({
        line,
        label: line.label,
        ordinal: index - base,
        statement,
        nextLineIndex,
        nextIndex: next,
        branches,
      });
    }
  }
  return Object.freeze(instructions);
}
