import { REPL } from './repl/repl';
import { ExecProgram } from './exec_program/exec_program';

class App {

  constructor() {
    let filePath : string = process.argv[2] ?  process.argv[2] : null;

    if (filePath) {
      this.execProgram(filePath);
    } else {
      this.startRepl();
    }
  }

  execProgram(filePath : string) : void {
    const program = new ExecProgram();
    program.start(filePath);
  }

  startRepl() : void {
    const repl = new REPL();
    repl.start();
  }
}

const app = new App();
