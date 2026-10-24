import type {Host, RunStatus, RunResult, SourceOptions} from '../core/types.ts';
import {createHost} from '../core/host.ts';
import {LineValidator} from './validators/line_validator.ts';
import {LineExecutor} from './executors/line_executor.ts';

export default class ExecProgram {
  host: Host;
  status!: RunStatus;
  _lineValidator!: LineValidator;
  _lineExecutor!: LineExecutor;
  constructor(host: Partial<Host> = {}) {
    this.host = createHost(host);
    this.reset();
  }

  reset() {
    this._lineValidator = new LineValidator();
    this._lineExecutor = new LineExecutor(this.host);
    this.status = 'ready';
  }

  run(source: string): RunResult {
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

  readLine(line: string, location: SourceOptions = {}): RunResult {
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
