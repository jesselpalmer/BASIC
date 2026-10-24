import type {InputOptions} from '../core/types.ts';

/** A completed temporary write; commit is the synchronous replacement boundary. */
export interface ProgramWrite {
  /**
   * Throw only before installation; false must never replace an existing path.
   * Return a warning only for cleanup failure after successful installation.
   */
  commit(overwrite: boolean): string | void;
  /** Release an abandoned temporary; harmless after commit or repeated calls. */
  discard(): Promise<void>;
}

/** File effects stay outside the terminal and the portable stored editor. */
export interface ProgramFiles {
  read(path: string, options: InputOptions): Promise<string>;
  exists(path: string, options: InputOptions): Promise<boolean>;
  /**
   * Honor cancellation and close/clean partial writes before rejecting. The caller
   * awaits preparation to retain ownership of its eventual staged resource.
   */
  prepareSave(path: string, source: string, options: InputOptions): Promise<ProgramWrite>;
}
