import type {Host, InputOptions} from '../core/types.ts';
import Basic from '../basic.ts';
import constants from '../shared/constants.ts';

export default class Repl {
  constructor(private host: Host & {writeError(text: string): void}) {
    this.host = host;
  }

  async start({signal}: InputOptions = {}) {
    const program = new Basic(this.host);
    this.host.write(`${constants.Strings.Repl.WELCOME_MESSAGE}\n`);
    for (;;) {
      const line = await this.host.readLine(constants.Strings.Repl.PROMPT, {signal});
      if (line === null || line === '') break;
      try {
        const result = program.readLine(line);
        if (result.status === 'halted') program.reset();
      } catch (error) {
        this.host.writeError(`${error instanceof Error ? error.message : String(error)}\n`);
        program.reset();
      }
    }
    this.host.write(`${constants.Strings.Repl.EXIT_MESSAGE}\n`);
  }
}
