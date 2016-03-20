export class LineValidator {
  usedLineNumbers : Array<number> = [];

  constructor() {
  }
  
  isLineValid(line : string) : boolean {
    let _isLineValid : boolean = true;
    
    if (this.hasLineBeenUsed(line)) {
      _isLineValid = false;
      console.log(`INVALID: ${line}`);
    } else {
      console.log(`VALID: ${line}`);
    }
    
    return _isLineValid;
  }

  hasLineBeenUsed(line : string) : boolean {
    return false;
  }
}