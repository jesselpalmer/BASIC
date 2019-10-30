import { abs } from './commands/abs_command';
import { cls } from './commands/cls_command';
import { end } from './commands/end_command';
import { print } from './commands/print_command';
import { rem } from './commands/rem_command';

export class LineExecutor {
  execLine(line : string) : void {
    const command : string = line.split(' ')[1];
    const message : string = line.split(/[""]/)[1];
    
    switch (command) {
      case 'ABS':
        abs(message);
        break;
      case 'CLS':
        cls();
        break;
      case 'END':
        end();
      case 'PRINT':
        print(message);
        break;
      case 'REM':
        rem(message);
        break;
      case '':
        break;
      default:
        console.log(`Invalid command`);
    }
  }
}
