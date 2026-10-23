export class BasicSyntaxError extends SyntaxError {
  constructor(code, message, position, label = null) {
    const location = label === null ?
      `Source line ${position.line}` : `Line ${label}`;
    super(`${location}, column ${position.column}: ${message}`);
    this.name = 'BasicSyntaxError';
    this.diagnostic = {code, message, label, ...position};
  }
}
