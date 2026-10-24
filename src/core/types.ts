export type BasicValue = number | string;
export type ComparisonOperator = '=' | '<>' | '<' | '<=' | '>' | '>=';
export interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}
export interface Location {
  readonly label: number | null;
  readonly start: Position;
  readonly end: Position;
}
export interface SourceOptions {
  line?: number;
  offset?: number;
}
export interface InputOptions {
  signal?: AbortSignal;
}
export interface Host {
  write(text: string): void;
  clear(): void;
  readLine(prompt?: string, options?: InputOptions): Promise<string | null>;
  random(): number;
}
export type RunStatus = 'ready' | 'running' | 'waiting' | 'halted' | 'error';
export interface RunResult {
  readonly status: RunStatus;
  readonly currentLocation: Location | null;
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
  ClsStatement: Record<never, never>;
  EndStatement: Record<never, never>;
  Line: {readonly label: number; readonly source: string; readonly statement: Statement};
}
export type NodeOf<K extends keyof NodeFields> = {
  readonly type: K;
  readonly location: Location;
} & NodeFields[K];
export type Expression = {
  [
    K in
      | 'NumberLiteral'
      | 'StringLiteral'
      | 'Variable'
      | 'GroupExpression'
      | 'UnaryExpression'
      | 'BinaryExpression'
      | 'CallExpression'
  ]: NodeOf<K>;
}[
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'Variable'
  | 'GroupExpression'
  | 'UnaryExpression'
  | 'BinaryExpression'
  | 'CallExpression'];
export type Comparison = NodeOf<'Comparison'>;
export type Statement = {
  [
    K in
      | 'LetStatement'
      | 'InputStatement'
      | 'IfStatement'
      | 'GotoStatement'
      | 'ForStatement'
      | 'NextStatement'
      | 'PrintStatement'
      | 'RemStatement'
      | 'ClsStatement'
      | 'EndStatement'
  ]: NodeOf<K>;
}[
  | 'LetStatement'
  | 'InputStatement'
  | 'IfStatement'
  | 'GotoStatement'
  | 'ForStatement'
  | 'NextStatement'
  | 'PrintStatement'
  | 'RemStatement'
  | 'ClsStatement'
  | 'EndStatement'];
export type ParsedLine = NodeOf<'Line'>;
export interface Program {
  readonly type: 'Program';
  readonly lines: readonly ParsedLine[];
}
