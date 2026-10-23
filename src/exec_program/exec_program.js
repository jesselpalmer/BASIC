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
    for (const line of source.split(/\r?\n/)) {
      if (line.trim() === '') continue;
      this.readLine(line);
      if (this.status === 'halted') break;
    }
    this.status = 'halted';
    return {status: this.status};
  }

  readLine(line) {
    if (this.status === 'halted' || this.status === 'error') {
      return {status: this.status};
    }
    try {
      this._lineValidator.validate(line);
      this.status = this._lineExecutor.execLine(line);
      return {status: this.status};
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }
}
