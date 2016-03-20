import * as rl from 'readline';
import * as fs from 'fs';
import { LineValidator } from './line_validator';

export class RunProgram {
  filePath : string;

  constructor(filePath : string) {
    this.filePath = filePath;
  }

  start() : void {
    this.openFile(this.filePath);
  }

  openFile(filePath : string) : void {
    const fileEncoding : string = 'utf-8';
    filePath = 'game.bas'; // seed added for testing

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
    
    if (fv.isLineValid(line)) {
      console.log(`${line}`);
    }
  }
}