import { commands } from '../../dictionaries/commands';

export class LineValidator {
  static _usedLineNumbers : Array<number> = [];
  _isLineValid : boolean = true;

  constructor() {
  }
  
  hasLineNumberBeenUsed(lineNumber : number) : boolean {
    if (LineValidator._usedLineNumbers.indexOf(lineNumber) === -1) {
      return false;
    }
    return true;
  }
  
  isLineNumberANumber() : boolean {
    return true;
  }
  
  isLineNumberValid(number : number) : boolean {
    return true;
  }
  
  validateLineNumber(lineNumberStr : string) {
    const radix = 10;
    const lineNumber = parseInt(lineNumberStr, radix);
    
    if (this.hasLineNumberBeenUsed(lineNumber)) {
      console.log(`INVALID: Line number has been used ${lineNumber}`);
      this._isLineValid = false;
    } else {
      LineValidator._usedLineNumbers.push(lineNumber);
    }
  }
  
  isLineValid(line : string) : boolean {
    const lineTokens = line.split(' ');
    const lineNumber = lineTokens[0];
    
    this.validateLineNumber(lineNumber);
    
    return this._isLineValid;
  }
}