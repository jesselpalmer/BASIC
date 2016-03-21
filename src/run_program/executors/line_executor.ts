import { print } from './commands/print_command';
import { rem } from './commands/rem_command';

export class LineExecutor {
  constructor() {
  }
  
  run(line : string) : void {
    switch (line) {
      case 'PRINT':
        print(line);
        break;
      case 'REM':
        rem(line);
        break;
      default:
        console.log(`Invalid command`);
    }
  }
}