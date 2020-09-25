import { Repl } from './repl/repl'
import { ExecProgram } from './exec_program/exec_program'

const INVALID_ARGUMENT_EXIT_CODE = 9

class Basic {
  constructor() {
    this.main()
  }

  private main(): void {
    const isTooManyArgs = process.argv.length > 3
    const isFilenameInputted = process.argv.length === 3
    const filenameIndex = 2

    if (isTooManyArgs) {
      console.log('Usage: nBASIC [script]')
      process.exit(INVALID_ARGUMENT_EXIT_CODE)
    } else if (isFilenameInputted) {
      const filePath = process.argv[filenameIndex]
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
    const repl = new Repl()
    repl.start()
  }
}

new Basic()
