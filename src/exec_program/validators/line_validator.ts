import { commands } from '../../dictionaries/commands';

export class LineValidator {
  usedLineNumbers : Array<number> = [];

  constructor() {
  }
  
  hasLineBeenUsed(line : string) : boolean {
    return false;
  }
  
  isLineNumberANumber() : boolean {
    return true;
  }
  
  isLineNumberValid(number : number) : boolean {
    return true;
  }
  
  isLineValid(line : string) : boolean {
    let _isLineValid : boolean = true;
    const lineTokens = line.split(' ');
    const lineNumber = lineTokens[0];
    
    return _isLineValid;
  }
}