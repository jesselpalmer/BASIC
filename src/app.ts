import { REPL } from './repl/repl';
import { ExecProgram } from './exec_program/exec_program';

class App {
  constructor() {
    this.main()
  }

  private main() {
    const isTooManyArgs = process.argv.length > 3
    const isFilenameInputted = process.argv.length === 3

    if (isTooManyArgs) {
      console.log('Usage: nBASIC [script]')
    } else if (isFilenameInputted) {
      const filePath : string = process.argv[2]
      this.runFile(filePath)
    } else {
      this.runPrompt()
    }
  }

  private runFile(filePath : string) : void {
    const program = new ExecProgram()
    program.start(filePath)
  }

  private runPrompt() : void {
    const repl = new REPL()
    repl.start()
  }
}

const app = new App();
