import type {Host, InputOptions, RunResult} from '../core/types.ts';
import {
  closeSync,
  constants as fileFlags,
  fstatSync,
  openSync,
  promises as fs,
  readFileSync,
} from 'node:fs';
import {join, resolve} from 'node:path';
import Basic from '../basic.ts';
import {isAbortError} from '../core/cancellation.ts';
import {createHost} from '../core/host.ts';
import Repl, {createTerminalProgram} from '../repl/repl.ts';
import type {ReplHost} from '../repl/repl.ts';
import constants from '../shared/constants.ts';
import TerminalHost from './terminal_host.ts';
import NodeProgramFiles from './program_files.ts';
import type {ProgramFiles} from '../repl/program_files.ts';
import {decodeSourceDocument} from '../core/source_document.ts';

/** The CLI owns interrupt routing and disposal; the REPL only needs program I/O. */
export interface CliHost extends ReplHost {
  discardEntry(): void;
  setInterruptHandler(handler: () => void): void;
  close(): void;
}

interface CliOptions {
  host?: CliHost;
  files?: ProgramFiles;
}

function chainLoader(directory: string): NonNullable<Host['loadProgram']> {
  const root = resolve(directory);
  return (name) => {
    // CHAIN admission has already restricted the tape name to alphanumerics and padding.
    const filename = join(root, `${name.trimEnd()}.bas`);
    let file: number;
    try {
      file = openSync(filename, fileFlags.O_RDONLY | fileFlags.O_NOFOLLOW | fileFlags.O_NONBLOCK);
    } catch (error) {
      const {code} = error as NodeJS.ErrnoException;
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP') return null;
      throw error;
    }
    try {
      return fstatSync(file).isFile() ? readFileSync(file, 'utf8') : null;
    } finally {
      closeSync(file);
    }
  };
}

export async function runFile(
  filePath: string,
  host: Partial<Host>,
  {signal}: InputOptions = {},
): Promise<RunResult> {
  const source = await fs.readFile(filePath, {encoding: 'utf8', signal});
  if (!filePath.toLowerCase().endsWith('.basic.json'))
    return new Basic(host).runAsync(source, {signal});
  const document = decodeSourceDocument(source);
  return createTerminalProgram(host, document.dialect).runAsync(document.source, {signal});
}

export async function runCli(
  args: readonly string[],
  {host = new TerminalHost(), files = new NodeProgramFiles()}: CliOptions = {},
): Promise<number> {
  const controller = new AbortController();
  let repl: Repl | null = null;
  const onInterrupt = () => {
    host.discardEntry();
    if (repl) repl.interrupt();
    else controller.abort();
  };
  process.on('SIGINT', onInterrupt);
  try {
    host.setInterruptHandler(onInterrupt);
    const hasChainDir = args[0] === '--chain-dir';
    const chainDir = hasChainDir ? args[1] : undefined;
    const scripts = hasChainDir ? args.slice(2) : args;
    if (
      scripts.length > 1 ||
      (hasChainDir && (!chainDir || chainDir === '--chain-dir' || scripts[0] === '--chain-dir'))
    ) {
      host.writeError(`${constants.ErrorMessages.TOO_MANY_ARGS}\n`);
      return constants.ExitCodes.INVALID_ARGUMENT;
    }
    const programHost = chainDir ? {...createHost(host), loadProgram: chainLoader(chainDir)} : host;
    if (scripts.length === 0) {
      repl = new Repl(host, files, programHost);
      return await repl.start({signal: controller.signal});
    }
    await runFile(scripts[0], programHost, {signal: controller.signal});
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
