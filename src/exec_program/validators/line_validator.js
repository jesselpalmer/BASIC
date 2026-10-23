export class LineValidator {
  constructor() {
    this._usedLineNumbers = new Set();
  }

  validate(line) {
    const lineNumberStr = line.split(' ')[0];
    const lineNumber = parseInt(lineNumberStr, 10);
    if (isNaN(lineNumber)) {
      throw new Error(
          `INVALID: Line number is not a valid number ${lineNumberStr}`,
      );
    }
    if (this._usedLineNumbers.has(lineNumber)) {
      throw new Error(`INVALID: Line number has been used ${lineNumber}`);
    }
    this._usedLineNumbers.add(lineNumber);
  }
}
