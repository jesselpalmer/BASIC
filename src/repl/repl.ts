import readline = require('readline')
import ExecProgram from '../exec_program/exec_program'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

export default class Repl {
  public start(): void {
    const program = new ExecProgram()
    console.log(`BASIC 0.0.8 (October 17, 2020)`)

    rl.setPrompt(`>>> `)
    rl.prompt()

    rl.on('line', (line) => {
      if (line === null || line === '') {
        console.log(`Have a great day :)`)
        process.exit(0)
      }
      program.readLine(line)
      rl.prompt()
    }).on('close', () => {
      console.log()
      console.log(`Have a great day :)`)
      process.exit(0)
    })
  }
}
