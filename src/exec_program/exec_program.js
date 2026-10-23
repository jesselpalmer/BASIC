import {createHost} from '../core/host.js';
import {LineValidator} from './validators/line_validator.js';
import {LineExecutor} from './executors/line_executor.js';

export default class ExecProgram {
  constructor(host = {}) {
    this.host = createHost(host);
    this.reset();
  }

  reset() {
    this._lineValidator = new LineValidator();
    this._lineExecutor = new LineExecutor(this.host);
    this.status = 'ready';
  }

  run(source) {
    this.reset();
    let physicalLine = 1;
    let offset = 0;
    // Keep line endings so diagnostics retain offsets in the original file.
    for (const line of source.split(/(?<=\n)/)) {
      this.readLine(line, {line: physicalLine, offset});
      if (this.status === 'halted') break;
      physicalLine++;
      offset += line.length;
    }
    this.status = 'halted';
    return {status: this.status};
  }

  readLine(line, location = {}) {
    if (this.status === 'halted' || this.status === 'error') {
      return {status: this.status};
    }
    try {
      const tokens = this._lineValidator.validate(line, location);
      this.status = this._lineExecutor.execLine(tokens);
      return {status: this.status};
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }
}
