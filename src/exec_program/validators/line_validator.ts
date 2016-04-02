import { commands } from '../../dictionaries/commands';

export class LineValidator {
  _usedLineNumbers : Array<number> = [];
  _isLineValid : boolean = true;

  constructor() {
  }
  
  hasLineNumberBeenUsed(line : string) : boolean {
    return false;
  }
  
  isLineNumberANumber() : boolean {
    return true;
  }
  
  isLineNumberValid(number : number) : boolean {
    return true;
  }
  
  validateLineNumber(lineNumber : string) {
    if (this.hasLineNumberBeenUsed(lineNumber)) {
      console.log(`INVALID: Line number has been used ${lineNumber}`);
      this._isLineValid = false;
    }
  }
  
  isLineValid(line : string) : boolean {
    const lineTokens = line.split(' ');
    const lineNumber = lineTokens[0];
    
    this.validateLineNumber(lineNumber);
    
    return this._isLineValid;
  }
}