import abs from './commands/abs_command.js';
import cls from './commands/cls_command.js';
import end from './commands/end_command.js';
import int from './commands/int_command.js';
import print from './commands/print_command.js';
import {BasicSyntaxError} from '../../core/diagnostic.js';

export class LineExecutor {
  constructor(host) {
    this.host = host;
  }

  execLine(tokens) {
    const statement = tokens.filter((token) =>
      token.type !== 'NEWLINE' && token.type !== 'EOF');
    if (statement.length === 0) return 'running';
    const [label, command, ...args] = statement;
    const fail = (message, token = command ?? tokens.at(-1)) => {
      throw new BasicSyntaxError('INVALID_STATEMENT',
          message, token.start, label.value);
    };
    if (!command) fail('Expected a statement after the line label');
    if (command.type !== 'KEYWORD') {
      fail(`Unsupported command ${command.raw}`);
    }
    const name = command.value;
    if (['ABS', 'INT', 'PRINT'].includes(name) &&
        (args.length !== 1 || args[0].type !== 'STRING')) {
      fail(`${name} currently expects one quoted string`, args[1] ?? args[0]);
    }
    if (['CLS', 'END'].includes(name) && args.length !== 0) {
      fail(`${name} takes no arguments`, args[0]);
    }
    const message = args[0]?.value;

    switch (name) {
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
        break;
      default:
        fail(`Unsupported command ${command.raw}`);
    }
    return 'running';
  }
}
