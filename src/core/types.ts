export type BasicValue = number | string;
/** Portable logical keys, independent of physical layouts and historical scan codes. */
export type LogicalKey =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'ENTER'
  | 'SPACE';
/** A copied, immutable observation of an explicitly assigned variable. */
export interface VariableSnapshot {
  readonly name: string;
  readonly value: BasicValue;
}
export type ComparisonOperator = '=' | '<>' | '<' | '<=' | '>' | '>=';
/** Physical source coordinates; line/column are 1-based UTF-16 units, offset is 0-based. */
export interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}
/** A half-open source span. BASIC labels are independent of physical line numbers. */
export interface Location {
  readonly label: number | null;
  readonly start: Position;
  readonly end: Position;
}
/** Historical profiles are unavailable until their semantics are implemented. */
export type Dialect = 'native';
export interface LanguageOptions {
  dialect?: Dialect;
}
export interface SourceOptions extends LanguageOptions {
  /** Starting physical line (default 1); a fragment always begins at column 1. */
  line?: number;
  /** Starting UTF-16 offset in the original source (default 0). */
  offset?: number;
}
export interface InputOptions {
  signal?: AbortSignal;
}
/** Resolve to resume execution; yield to a host task and release owned resources on abort. */
export type ExecutionScheduler = (signal: AbortSignal) => Promise<void>;
export interface RunOptions extends InputOptions {
  /** Nonnegative safe integer; counts executed statements, including INPUT, WAIT, and END. */
  instructionLimit?: number;
  /** Positive safe integer; statements per batch (default 256). */
  yieldEvery?: number;
  /** Defaults to a cancellable timer task; an already-resolved promise does not yield to I/O. */
  scheduler?: ExecutionScheduler;
  /** Optional debugger gate before each statement; cancellation releases a suspended gate. */
  beforeStatement?: (signal: AbortSignal) => void | Promise<void>;
}
/** Stateless drawing in the fixed 320 by 200 logical pixel surface. */
export type GraphicsCommand =
  | {readonly kind: 'pset'; readonly x: number; readonly y: number; readonly color: number}
  | {
      readonly kind: 'line';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly color: number;
    }
  | {
      readonly kind: 'circle';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly color: number;
    };
/** Synchronous output and async input capabilities; the interpreter owns no terminal or files. */
export interface Host {
  write(text: string): void;
  clear(): void;
  /** Optional graphics capability; clip primitives to the logical surface in bounded work. */
  draw?(command: GraphicsCommand): void;
  /** Consume one queued logical key; return an empty string when no key is queued. */
  readKey?(): LogicalKey | '';
  /** Observe a supported logical key without consuming queued input. */
  keyDown?(key: LogicalKey): boolean;
  /** Suspend for a normalized duration; honor cancellation to release owned timers. */
  wait(milliseconds: number, options?: InputOptions): Promise<void>;
  /** Return untrimmed text, or null at EOF. Honor the signal to release input resources. */
  readLine(prompt?: string, options?: InputOptions): Promise<string | null>;
  /** Return a finite number in [0, 1). */
  random(): number;
}
export type RunStatus = 'ready' | 'running' | 'waiting' | 'halted' | 'error';
/** Immutable observation of execution; locations retain the original physical source positions. */
export interface RunResult {
  readonly status: RunStatus;
  /**
   * Most recently attempted statement, or the statement blocked by an instruction
   * limit or scheduler failure. Initially null.
   */
  readonly currentLocation: Location | null;
  /** Next statement when ready/running; null while waiting, halted, or in error. */
  readonly nextLocation: Location | null;
  readonly diagnostic: Readonly<Diagnostic> | null;
}
export interface Diagnostic extends Position {
  code: string;
  message: string;
  label: number | null;
}
export interface TokenValues {
  LABEL: number;
  NUMBER: number;
  STRING: string;
  KEYWORD: string;
  IDENTIFIER: string;
  OPERATOR: string;
  PUNCTUATION: string;
  COMMENT: string;
  NEWLINE: null;
  EOF: null;
}
export type TokenType = keyof TokenValues;
export type TokenOf<K extends TokenType> = {
  readonly type: K;
  readonly value: TokenValues[K];
  readonly raw: string;
  readonly label: number | null;
  readonly start: Position;
  readonly end: Position;
};
export type Token = {[K in TokenType]: TokenOf<K>}[TokenType];
export interface NodeFields {
  NumberLiteral: {readonly value: number; readonly raw: string};
  StringLiteral: {readonly value: string; readonly raw: string};
  Variable: {readonly name: string};
  GroupExpression: {readonly expression: Expression};
  UnaryExpression: {
    readonly operator: string;
    readonly operatorLocation: Location;
    readonly argument: Expression;
  };
  BinaryExpression: {
    readonly operator: string;
    readonly operatorLocation: Location;
    readonly left: Expression;
    readonly right: Expression;
  };
  CallExpression: {
    readonly name: string;
    readonly nameLocation: Location;
    readonly arguments: readonly Expression[];
  };
  Comparison: {
    readonly left: Expression;
    readonly right: Expression;
    readonly operator: ComparisonOperator;
    readonly operatorLocation: Location;
  };
  IfStatement: {readonly condition: Comparison; readonly target: NodeOf<'NumberLiteral'>};
  GotoStatement: {readonly target: NodeOf<'NumberLiteral'>};
  ForStatement: {
    readonly variable: NodeOf<'Variable'>;
    readonly start: Expression;
    readonly end: Expression;
    readonly step: Expression | null;
  };
  NextStatement: {readonly variable: NodeOf<'Variable'>};
  LetStatement: {readonly target: NodeOf<'Variable'>; readonly expression: Expression};
  InputStatement: {
    readonly prompt: NodeOf<'StringLiteral'> | null;
    readonly target: NodeOf<'Variable'>;
  };
  PrintStatement: {
    readonly items: readonly Expression[];
    readonly separators: readonly Location[];
    readonly trailingSemicolon: boolean;
  };
  RemStatement: {readonly text: string};
  WaitStatement: {readonly duration: Expression};
  ColorStatement: {readonly color: Expression};
  PsetStatement: {readonly x: Expression; readonly y: Expression};
  LineStatement: {
    readonly x1: Expression;
    readonly y1: Expression;
    readonly x2: Expression;
    readonly y2: Expression;
  };
  CircleStatement: {readonly x: Expression; readonly y: Expression; readonly radius: Expression};
  ClsStatement: Record<never, never>;
  EndStatement: Record<never, never>;
  Line: {
    /** Omitted only in legacy caller-supplied trees; omission means native. */
    readonly dialect?: Dialect;
    readonly label: number;
    readonly source: string;
    readonly statement: Statement;
  };
}
export type NodeOf<K extends keyof NodeFields> = {
  readonly type: K;
  readonly location: Location;
} & NodeFields[K];
// Map each kind separately so the discriminator stays paired with its own fields.
type Nodes<K extends keyof NodeFields> = {[P in K]: NodeOf<P>}[K];
export type Expression = Nodes<
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'Variable'
  | 'GroupExpression'
  | 'UnaryExpression'
  | 'BinaryExpression'
  | 'CallExpression'
>;
export type Comparison = NodeOf<'Comparison'>;
export type Statement = Nodes<
  | 'LetStatement'
  | 'InputStatement'
  | 'IfStatement'
  | 'GotoStatement'
  | 'ForStatement'
  | 'NextStatement'
  | 'PrintStatement'
  | 'RemStatement'
  | 'WaitStatement'
  | 'ColorStatement'
  | 'PsetStatement'
  | 'LineStatement'
  | 'CircleStatement'
  | 'ClsStatement'
  | 'EndStatement'
>;
export type GraphicsStatement = Extract<
  Statement,
  {type: 'ColorStatement' | 'PsetStatement' | 'LineStatement' | 'CircleStatement'}
>;
export type ParsedLine = NodeOf<'Line'>;
export interface Program {
  readonly type: 'Program';
  /** Omitted only in legacy caller-supplied trees; omission means native. */
  readonly dialect?: Dialect;
  readonly lines: readonly ParsedLine[];
}
