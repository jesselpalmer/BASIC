export class LineValidator {
  static _usedLineNumbers: Set<number> = new Set()
  
  hasLineNumberBeenUsed(lineNumberStr: string) : boolean {
    const radix = 10
    const lineNumber = parseInt(lineNumberStr, radix)
    let hasLineNumBeenUsed = false
    
    if (LineValidator._usedLineNumbers.has(lineNumber)) {
      console.log(`INVALID: Line number has been used ${lineNumber}`)
      hasLineNumBeenUsed = true
    } else {
      LineValidator._usedLineNumbers.add(lineNumber)
    }

    return hasLineNumBeenUsed
  }
  
  isLineNumberANumber(lineNumberStr: string) : boolean {
    const radix = 10
    let isLineValid = true
    
    if (isNaN(parseInt(lineNumberStr, radix))) {
      console.log(`INVALID: Line number is not a valid number ${lineNumberStr}`)
      isLineValid = false
    }
    
    return isLineValid
  }
  
  isLineValid(line: string) : boolean {
    const lineTokens = line.split(' ')
    const lineNumber = lineTokens[0]
    let isLineValid = true
    
    if (!this.isLineNumberANumber(lineNumber)) {
      isLineValid = false
    } else if (this.hasLineNumberBeenUsed(lineNumber)) {
      isLineValid = false
    }
   
    return isLineValid
  }
}
