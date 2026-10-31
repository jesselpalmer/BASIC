import {parseProgram} from '../parser/parser.ts';
import {
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
  type SourceDocument,
} from '../core/source_document.ts';
import type {Dialect, LanguageOptions} from '../core/types.ts';

/** The browser supplies local storage; this controller never accesses the DOM. */
export interface DocumentStorage {
  /** Current portable envelope, or null when it has never been saved. */
  read(): string | null;
  /** Optional source-only draft from the pre-envelope storage key. */
  readLegacy?(): string | null;
  /** Store the complete source+dialect envelope as one value. */
  write(document: string): void;
}

export type DocumentStorageStatus =
  | {kind: 'unavailable' | 'empty' | 'restored' | 'saved'}
  | {kind: 'error'; operation: 'restore' | 'save'; message: string};

export interface DocumentReplacement {
  readonly source: string;
  readonly dialect: Dialect;
  readonly candidate: string;
  readonly candidateDialect: Dialect;
  readonly reason: 'example' | 'import';
}

export type ConfirmDocumentReplacement = (
  replacement: DocumentReplacement,
) => boolean | Promise<boolean>;

export type DocumentReplacementResult =
  | {kind: 'replaced'}
  | {kind: 'cancelled'}
  | {kind: 'stale'}
  | {kind: 'invalid' | 'read-failed' | 'confirmation-failed'; message: string};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Exact editable text and immutable language context outlive any validated run snapshot. */
export class BrowserDocument {
  #document: SourceDocument;
  #storage: DocumentStorage | undefined;
  #storageStatus: DocumentStorageStatus = {kind: 'unavailable'};
  #generation = 0;

  constructor(initialSource: string, storage?: DocumentStorage, options: LanguageOptions = {}) {
    this.#document = createSourceDocument(initialSource, options);
    this.#storage = storage;
    if (!storage) return;
    let current: string | null;
    try {
      current = storage.read();
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'restore', message: message(error)};
      return;
    }
    if (current !== null) {
      try {
        this.#document = decodeSourceDocument(current);
        this.#storageStatus = {kind: 'restored'};
      } catch (error) {
        this.#storageStatus = {kind: 'error', operation: 'restore', message: message(error)};
      }
      return;
    }
    let legacy: string | null;
    try {
      legacy = storage.readLegacy?.() ?? null;
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'restore', message: message(error)};
      return;
    }
    if (legacy === null) {
      this.#storageStatus = {kind: 'empty'};
      return;
    }
    this.#document = createSourceDocument(legacy, {dialect: 'native'});
    try {
      storage.write(encodeSourceDocument(legacy, {dialect: 'native'}));
      this.#storageStatus = {kind: 'restored'};
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'save', message: message(error)};
    }
  }

  get source(): string {
    return this.#document.source;
  }

  get dialect(): Dialect {
    return this.#document.dialect;
  }

  get context(): SourceDocument {
    return this.#document;
  }

  get storageStatus(): DocumentStorageStatus {
    return {...this.#storageStatus};
  }

  edit(source: string): void {
    ++this.#generation;
    this.#document = createSourceDocument(source, {dialect: this.#document.dialect});
    this.#save();
  }

  exportSource(): string {
    return this.#document.source;
  }

  exportDocument(): string {
    return encodeSourceDocument(this.#document.source, {dialect: this.#document.dialect});
  }

  replaceWithExample(
    source: string,
    confirm: ConfirmDocumentReplacement,
    options: LanguageOptions = {},
  ): Promise<DocumentReplacementResult> {
    const generation = ++this.#generation;
    let candidate: SourceDocument;
    try {
      candidate = createSourceDocument(source, options);
    } catch (error) {
      return Promise.resolve({kind: 'invalid', message: message(error)});
    }
    return this.#replace(candidate, 'example', confirm, generation);
  }

  importSource(
    read: () => Promise<string>,
    confirm: ConfirmDocumentReplacement,
    options: LanguageOptions = {},
  ): Promise<DocumentReplacementResult> {
    return this.#import(read, confirm, 'source', options);
  }

  importDocument(
    read: () => Promise<string>,
    confirm: ConfirmDocumentReplacement,
  ): Promise<DocumentReplacementResult> {
    return this.#import(read, confirm, 'document');
  }

  async #import(
    read: () => Promise<string>,
    confirm: ConfirmDocumentReplacement,
    kind: 'source' | 'document',
    options: LanguageOptions = {},
  ): Promise<DocumentReplacementResult> {
    const generation = ++this.#generation;
    let serialized: string;
    try {
      serialized = await read();
    } catch (error) {
      if (generation !== this.#generation) return {kind: 'stale'};
      return {kind: 'read-failed', message: message(error)};
    }
    if (generation !== this.#generation) return {kind: 'stale'};
    let candidate: SourceDocument;
    try {
      candidate =
        kind === 'document'
          ? decodeSourceDocument(serialized)
          : createSourceDocument(serialized, options);
    } catch (error) {
      return {kind: 'invalid', message: message(error)};
    }
    return this.#replace(candidate, 'import', confirm, generation);
  }

  async #replace(
    candidate: SourceDocument,
    reason: DocumentReplacement['reason'],
    confirm: ConfirmDocumentReplacement,
    generation: number,
  ): Promise<DocumentReplacementResult> {
    try {
      parseProgram(candidate.source, {dialect: candidate.dialect});
    } catch (error) {
      return {kind: 'invalid', message: message(error)};
    }
    if (
      (this.#document.source !== candidate.source ||
        this.#document.dialect !== candidate.dialect) &&
      this.#document.source.length > 0
    ) {
      let accepted: boolean;
      const replacement = Object.freeze({
        source: this.#document.source,
        dialect: this.#document.dialect,
        candidate: candidate.source,
        candidateDialect: candidate.dialect,
        reason,
      });
      try {
        accepted = await confirm(replacement);
      } catch (error) {
        if (generation !== this.#generation) return {kind: 'stale'};
        return {kind: 'confirmation-failed', message: message(error)};
      }
      if (generation !== this.#generation) return {kind: 'stale'};
      if (!accepted) return {kind: 'cancelled'};
    }
    this.#document = candidate;
    this.#save();
    return {kind: 'replaced'};
  }

  #save(): void {
    if (!this.#storage) return;
    try {
      this.#storage.write(this.exportDocument());
      this.#storageStatus = {kind: 'saved'};
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'save', message: message(error)};
    }
  }
}
