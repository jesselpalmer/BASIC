import * as rl from 'readline';
import * as fs from 'fs';
import { LineValidator } from './validators/line_validator';
import { LineExecutor } from './executors/line_executor';

export class ExecProgram {
  constructor() {
  }

  start(filePath : string) : void {
    this.openFile(filePath);
  }

  openFile(filePath : string) : void {
    const fileEncoding : string = 'utf-8';

    fs.readFile(filePath, fileEncoding, (err, fileContents) => {
      if (err) throw err;
      console.log(`OK: ${filePath}`);

      const rd = rl.createInterface({
        input: fs.createReadStream(filePath),
        output: process.stdout,
        terminal: false
      });

      rd.on('line', this.readLine);     
    });
  }
  
  readLine(line) : void {
    let fv = new LineValidator();
    let le = new LineExecutor();
    
    if (fv.isLineValid(line)) {
      le.execLine(line);
    } else {
      console.log(`INVALID: ${line}`);
    }
  }
}