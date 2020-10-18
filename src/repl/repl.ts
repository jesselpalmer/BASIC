import readline = require('readline')
import ExecProgram from '../exec_program/exec_program'
import constants from '../shared/constants'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

export default class Repl {
  public start(): void {
    const program = new ExecProgram()
    console.log(constants.Strings.Repl.WELCOME_MESSAGE)

    rl.setPrompt(constants.Strings.Repl.PROMPT)
    rl.prompt()

    rl.on('line', (line) => {
      const isLineEmpty = line === null || line === ''

      if (isLineEmpty) {
        console.log(constants.Strings.Repl.EXIT_MESSAGE)
        process.exit(constants.ExitCodes.NORMAL)
      }
      
      program.readLine(line)
      rl.prompt()
    }).on('close', () => {
      console.log()
      console.log(constants.Strings.Repl.EXIT_MESSAGE)
      process.exit(constants.ExitCodes.NORMAL)
    })
  }
}
