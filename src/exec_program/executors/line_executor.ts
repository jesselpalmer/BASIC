import type {Host, Token} from '../../core/types.ts';
import abs from './commands/abs_command.ts';
import cls from './commands/cls_command.ts';
import end from './commands/end_command.ts';
import int from './commands/int_command.ts';
import print from './commands/print_command.ts';
import {BasicSyntaxError} from '../../core/diagnostic.ts';

export class LineExecutor {
  constructor(private host: Host) {
    this.host = host;
  }

  execLine(tokens: Token[]): 'running' | 'halted' {
    const statement = tokens.filter((token) => token.type !== 'NEWLINE' && token.type !== 'EOF');
    if (statement.length === 0) return 'running';
    const [label, command, ...args] = statement;
    const fail = (message: string, token = command ?? tokens.at(-1)): never => {
      throw new BasicSyntaxError('INVALID_STATEMENT', message, token!.start, label.value as number);
    };
    if (!command) fail('Expected a statement after the line label');
    if (command.type !== 'KEYWORD') {
      fail(`Unsupported command ${command.raw}`);
    }
    const name = String(command.value);
    if (
      ['ABS', 'INT', 'PRINT'].includes(name) &&
      (args.length !== 1 || args[0].type !== 'STRING')
    ) {
      fail(`${name} currently expects one quoted string`, args[1] ?? args[0]);
    }
    if (['CLS', 'END'].includes(name) && args.length !== 0) {
      fail(`${name} takes no arguments`, args[0]);
    }
    const argument = args[0];
    const message = argument?.type === 'STRING' ? argument.value : undefined;

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
