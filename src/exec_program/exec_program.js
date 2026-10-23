import * as rl from 'readline';
import * as fs from 'fs';
import {LineValidator} from './validators/line_validator';
import {LineExecutor} from './executors/line_executor';

export default class ExecProgram {
  constructor() {
    this._lineValidator = new LineValidator();
    this._lineExecutor = new LineExecutor();
  }

  start(filePath) {
    this.openFile(filePath);
  }

  openFile(filePath) {
    const fileEncoding = 'utf-8';
    // Each file owns its history, including when this runner is reused.
    const fileProgram = new ExecProgram();

    fs.readFile(filePath, fileEncoding, (err) => {
      if (err) throw err;
      console.log(`OK: ${filePath}`);

      const rd = rl.createInterface({
        input: fs.createReadStream(filePath),
        output: process.stdout,
        terminal: false,
      });

      rd.on('line', (line) => fileProgram.readLine(line));
    });
  }

  readLine(line) {
    if (this._lineValidator.isLineValid(line)) {
      this._lineExecutor.execLine(line);
    } else {
      console.log(`INVALID: ${line}`);
    }
  }
}
