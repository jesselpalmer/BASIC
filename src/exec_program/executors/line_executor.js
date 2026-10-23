import abs from './commands/abs_command.js';
import cls from './commands/cls_command.js';
import end from './commands/end_command.js';
import int from './commands/int_command.js';
import print from './commands/print_command.js';

export class LineExecutor {
  constructor(host) {
    this.host = host;
  }

  execLine(line) {
    const command = line.split(' ')[1];
    const message = line.split(/[""]/)[1];

    switch (command) {
      case 'ABS':
        abs(message, this.host);
        break;
      case 'CLS':
        cls(this.host);
        break;
      case 'END':
        return end();
      case 'INT':
        int(message, this.host);
        break;
      case 'PRINT':
        print(message, this.host);
        break;
      case 'REM':
      case '':
        break;
      default:
        throw new Error('Invalid command');
    }
    return 'running';
  }
}
