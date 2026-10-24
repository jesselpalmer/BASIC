import type {Host, InputOptions, RunResult} from '../core/types.ts';
import {promises as fs} from 'node:fs';
import Basic from '../basic.ts';
import {isAbortError} from '../core/cancellation.ts';
import Repl from '../repl/repl.ts';
import type {ReplHost} from '../repl/repl.ts';
import constants from '../shared/constants.ts';
import TerminalHost from './terminal_host.ts';

/** The CLI owns interrupt routing and disposal; the REPL only needs program I/O. */
export interface CliHost extends ReplHost {
  discardEntry(): void;
  setInterruptHandler(handler: () => void): void;
  close(): void;
}

interface CliOptions {
  host?: CliHost;
}

export async function runFile(
  filePath: string,
  host: Partial<Host>,
  {signal}: InputOptions = {},
): Promise<RunResult> {
  const source = await fs.readFile(filePath, {encoding: 'utf8', signal});
  return new Basic(host).runAsync(source, {signal});
}

export async function runCli(
  args: readonly string[],
  {host = new TerminalHost()}: CliOptions = {},
): Promise<number> {
  const controller = new AbortController();
  const repl = args.length === 0 ? new Repl(host) : null;
  const onInterrupt = () => {
    host.discardEntry();
    if (repl) repl.interrupt();
    else controller.abort();
  };
  process.on('SIGINT', onInterrupt);
  try {
    host.setInterruptHandler(onInterrupt);
    if (args.length > 1) {
      host.writeError(`${constants.ErrorMessages.TOO_MANY_ARGS}\n`);
      return constants.ExitCodes.INVALID_ARGUMENT;
    }
    if (repl) return await repl.start({signal: controller.signal});
    await runFile(args[0], host, {signal: controller.signal});
    return constants.ExitCodes.NORMAL;
  } catch (error) {
    if (isAbortError(error)) return 130;
    host.writeError(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    host.close();
  }
}
