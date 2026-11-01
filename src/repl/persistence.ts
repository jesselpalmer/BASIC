import {abortable} from '../core/cancellation.ts';
import {parseProgram} from '../parser/parser.ts';
import type {FileCommand} from './file_command.ts';
import type {ProgramFiles} from './program_files.ts';
import type StoredProgram from './program.ts';
import {
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
} from '../core/source_document.ts';

type Confirm = (prompt: string, signal: AbortSignal) => Promise<boolean>;

/** Staged file operations never change editor state before their commit point. */
export default class ProgramPersistence {
  constructor(
    private source: StoredProgram,
    private files: ProgramFiles,
  ) {}

  async execute(
    command: FileCommand,
    confirm: Confirm,
    signal: AbortSignal,
  ): Promise<string | void> {
    if (command.kind === 'LOAD') {
      const text = await abortable(
        () => this.files.read(command.path, {signal}),
        signal,
        'Could not read program file',
      );
      signal.throwIfAborted();
      const portable = command.path.toLowerCase().endsWith('.basic.json');
      const document = portable ? decodeSourceDocument(text) : createSourceDocument(text);
      const candidate = parseProgram(document.source, {dialect: document.dialect});
      if (
        this.source.dirty &&
        !(await confirm('Discard unsaved changes and load a program? [y/N] ', signal))
      ) {
        return;
      }
      signal.throwIfAborted();
      this.source.replace(candidate, command.path, portable ? document.source : undefined);
      return;
    }

    const path = command.path ?? this.source.filename;
    if (path === null) throw new Error('SAVE requires a quoted filename before the first save');
    const exists = await abortable(
      () => this.files.exists(path, {signal}),
      signal,
      'Could not inspect program file',
    );
    signal.throwIfAborted();
    if (exists && !(await confirm(`Overwrite ${JSON.stringify(path)}? [y/N] `, signal))) return;
    signal.throwIfAborted();
    const document = this.source.document;
    const text = path.toLowerCase().endsWith('.basic.json')
      ? encodeSourceDocument(document.source, {dialect: document.dialect})
      : document.source;
    const write = await this.files.prepareSave(path, text, {signal});
    let committed = false;
    try {
      signal.throwIfAborted();
      // No await separates replacement from the clean baseline. Interrupts after
      // this synchronous boundary belong to the next operation, not this save.
      const warning = write.commit(exists);
      this.source.saved(path);
      committed = true;
      return warning;
    } finally {
      if (!committed) await write.discard();
    }
  }
}
