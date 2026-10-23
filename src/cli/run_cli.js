import {promises as fs} from 'node:fs';
import Basic from '../basic.js';
import Repl from '../repl/repl.js';
import constants from '../shared/constants.js';
import TerminalHost from './terminal_host.js';

export async function runFile(filePath, host, {signal} = {}) {
  const source = await fs.readFile(filePath, {encoding: 'utf8', signal});
  return new Basic(host).run(source);
}

export async function runCli(args, {host = new TerminalHost()} = {}) {
  const controller = new AbortController();
  const onInterrupt = () => controller.abort();
  process.on('SIGINT', onInterrupt);
  try {
    host.setInterruptHandler(onInterrupt);
    if (args.length > 1) {
      host.writeError(`${constants.ErrorMessages.TOO_MANY_ARGS}\n`);
      return constants.ExitCodes.INVALID_ARGUMENT;
    }
    if (args.length === 1) {
      await runFile(args[0], host, {signal: controller.signal});
    } else {
      await new Repl(host).start({signal: controller.signal});
    }
    return constants.ExitCodes.NORMAL;
  } catch (error) {
    if (error.name === 'AbortError') return 130;
    host.writeError(`${error.message}\n`);
    return 1;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    host.close();
  }
}
