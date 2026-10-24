import {promises as fs, linkSync, renameSync, unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname, join} from 'node:path';
import type {InputOptions} from '../core/types.ts';
import type {ProgramFiles, ProgramWrite} from '../repl/program_files.ts';

export default class NodeProgramFiles implements ProgramFiles {
  async read(path: string, {signal}: InputOptions): Promise<string> {
    return fs.readFile(path, {encoding: 'utf8', signal});
  }

  async exists(path: string, {signal}: InputOptions): Promise<boolean> {
    signal?.throwIfAborted();
    try {
      // lstat also detects a dangling symlink: replacing one still needs consent.
      await fs.lstat(path);
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async prepareSave(path: string, source: string, {signal}: InputOptions): Promise<ProgramWrite> {
    signal?.throwIfAborted();
    const temporary = join(dirname(path), `.basic-${randomUUID()}.tmp`);
    // Exclusive creation means failure never removes a preexisting file.
    const handle = await fs.open(temporary, 'wx', 0o600);
    let committed = false;
    const discard = async () => {
      if (!committed) await fs.rm(temporary, {force: true});
    };
    try {
      try {
        await handle.writeFile(source, {encoding: 'utf8', signal});
      } finally {
        await handle.close();
      }
      signal?.throwIfAborted();
    } catch (error) {
      await discard();
      throw error;
    }
    return {
      commit(overwrite) {
        // rename is atomic in the destination directory. Keeping this small
        // commit synchronous prevents cancellation between replacement and the
        // caller's matching session-state commit.
        if (overwrite) {
          renameSync(temporary, path);
          committed = true;
          return;
        }
        // A new destination must remain exclusive even if another writer creates
        // it after the preflight check. Linking installs the complete file or
        // fails with EEXIST, without clobbering the competing writer's bytes.
        linkSync(temporary, path);
        committed = true;
        try {
          unlinkSync(temporary);
          return;
        } catch (error) {
          // Installation has already succeeded. Report cleanup separately so the
          // caller records the saved baseline instead of claiming rollback.
          const detail = error instanceof Error ? error.message : String(error);
          return (
            `Saved ${JSON.stringify(path)}, but could not remove temporary file ` +
            `${JSON.stringify(temporary)}: ${detail}`
          );
        }
      },
      discard,
    };
  }
}
