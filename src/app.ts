import { REPL } from './repl/repl';
import { RunProgram } from './run_program/run_program';

class App {

  constructor() {
    let filePath : string = process.argv[2] ?  process.argv[2] : null;

    if (filePath) {
      this.runProgram(filePath);
    } else {
      this.startRepl();
    }
  }

  runProgram(filePath : string) : void {
    const program = new RunProgram(filePath);
    program.start();
  }

  startRepl() : void {
    const repl = new REPL();
    repl.start();
  }
}

const app = new App();