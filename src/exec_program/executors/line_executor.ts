import abs from './commands/abs_command'
import cls from './commands/cls_command'
import end from './commands/end_command'
import int from './commands/int_command'
import print from './commands/print_command'

export class LineExecutor {
  execLine(line: string): void {
    const command = line.split(' ')[1]
    const message = line.split(/[""]/)[1]
    
    switch (command) {
      case 'ABS':
        abs(message)
        break
      case 'CLS':
        cls()
        break
      case 'END':
        end()
        break
      case 'INT':
        int(message)
        break
      case 'PRINT':
        print(message)
        break
      case 'REM':
        break
      case '':
        break
      default:
        console.log(`Invalid command`)
    }
  }
}
