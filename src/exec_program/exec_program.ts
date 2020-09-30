import * as rl from 'readline'
import * as fs from 'fs'
import { LineValidator } from './validators/line_validator'
import { LineExecutor } from './executors/line_executor'

export default class ExecProgram {
  public start(filePath: string): void {
    this.openFile(filePath)
  }

  private openFile(filePath: string): void {
    const fileEncoding = 'utf-8'

    fs.readFile(filePath, fileEncoding, (err): void => {
      if (err) throw err
      console.log(`OK: ${filePath}`)

      const rd = rl.createInterface({
        input: fs.createReadStream(filePath),
        output: process.stdout,
        terminal: false
      })

      rd.on('line', this.readLine)
    })
  }
  
  private readLine(line: string): void {
    const fv = new LineValidator()
    const le = new LineExecutor()
    
    if (fv.isLineValid(line)) {
      le.execLine(line)
    } else {
      console.log(`INVALID: ${line}`)
    }
  }
}
