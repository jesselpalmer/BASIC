import type {Diagnostic, Position} from './types.ts';
export class BasicSyntaxError extends SyntaxError {
  readonly diagnostic: Diagnostic;
  constructor(code: string, message: string, position: Position, label: number | null = null) {
    const location = label === null ? `Source line ${position.line}` : `Line ${label}`;
    super(`${location}, column ${position.column}: ${message}`);
    this.name = 'BasicSyntaxError';
    this.diagnostic = {code, message, label, ...position};
  }
}

export class BasicRuntimeError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(
    code: string,
    message: string,
    position: Position,
    label: number | null = null,
    options?: ErrorOptions,
  ) {
    const location = label === null ? `Source line ${position.line}` : `Line ${label}`;
    super(`${location}, column ${position.column}: ${message}`, options);
    this.name = 'BasicRuntimeError';
    this.diagnostic = {code, message, label, ...position};
  }
}
