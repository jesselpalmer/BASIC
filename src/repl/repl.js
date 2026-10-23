import Basic from '../basic.js';
import constants from '../shared/constants.js';

export default class Repl {
  constructor(host) {
    this.host = host;
  }

  async start({signal} = {}) {
    const program = new Basic(this.host);
    this.host.write(`${constants.Strings.Repl.WELCOME_MESSAGE}\n`);
    for (;;) {
      const line = await this.host.readLine(
          constants.Strings.Repl.PROMPT, {signal},
      );
      if (line === null || line === '') break;
      try {
        const result = program.readLine(line);
        if (result.status === 'halted') program.reset();
      } catch (error) {
        this.host.writeError(`${error.message}\n`);
        program.reset();
      }
    }
    this.host.write(`${constants.Strings.Repl.EXIT_MESSAGE}\n`);
  }
}
