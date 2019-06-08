import { cls } from './commands/cls_command';
import { print } from './commands/print_command';
import { rem } from './commands/rem_command';

export class LineExecutor {
  execLine(line : string) : void {
    const command : string = line.split(' ')[1];
    const message : string = line.split(/[""]/)[1];
    
    switch (command) {
      case 'CLS':
        cls();
        break;
      case 'PRINT':
        print(message);
        break;
      case 'REM':
        rem(message);
        break;
      default:
        console.log(`Invalid command`);
    }
  }
}