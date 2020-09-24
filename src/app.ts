import { REPL } from './repl/repl'
import { ExecProgram } from './exec_program/exec_program'

class App {
  constructor() {
    this.main()
  }

  private main(): void {
    const isTooManyArgs = process.argv.length > 3
    const isFilenameInputted = process.argv.length === 3
    const filenameIndex = 2

    if (isTooManyArgs) {
      console.log('Usage: nBASIC [script]')
    } else if (isFilenameInputted) {
      const filePath: string = process.argv[filenameIndex]
      this.runFile(filePath)
    } else {
      this.runPrompt()
    }
  }

  private runFile(filePath: string): void {
    const program = new ExecProgram()
    program.start(filePath)
  }

  private runPrompt(): void {
    const repl = new REPL()
    repl.start()
  }
}

const app = new App();
