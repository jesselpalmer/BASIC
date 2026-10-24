import {parseProgram} from '../parser/parser.ts';

/** The browser supplies local storage; this controller never accesses the DOM. */
export interface DocumentStorage {
  read(): string | null;
  write(source: string): void;
}

export type DocumentStorageStatus =
  | {kind: 'unavailable' | 'empty' | 'restored' | 'saved'}
  | {kind: 'error'; operation: 'restore' | 'save'; message: string};

export interface DocumentReplacement {
  source: string;
  candidate: string;
  reason: 'example' | 'import';
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

/** Exact editable text has a different lifetime from a validated running snapshot. */
export class BrowserDocument {
  #source: string;
  #storage: DocumentStorage | undefined;
  #storageStatus: DocumentStorageStatus = {kind: 'unavailable'};
  #generation = 0;

  constructor(initialSource: string, storage?: DocumentStorage) {
    this.#source = initialSource;
    this.#storage = storage;
    if (!storage) return;
    try {
      const restored = storage.read();
      if (restored === null) {
        this.#storageStatus = {kind: 'empty'};
      } else {
        this.#source = restored;
        this.#storageStatus = {kind: 'restored'};
      }
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'restore', message: message(error)};
    }
  }

  get source(): string {
    return this.#source;
  }

  get storageStatus(): DocumentStorageStatus {
    return {...this.#storageStatus};
  }

  edit(source: string): void {
    ++this.#generation;
    this.#source = source;
    this.#save();
  }

  exportSource(): string {
    return this.#source;
  }

  replaceWithExample(
    source: string,
    confirm: ConfirmDocumentReplacement,
  ): Promise<DocumentReplacementResult> {
    return this.#replace(source, 'example', confirm, ++this.#generation);
  }

  async importSource(
    read: () => Promise<string>,
    confirm: ConfirmDocumentReplacement,
  ): Promise<DocumentReplacementResult> {
    const generation = ++this.#generation;
    let source: string;
    try {
      source = await read();
    } catch (error) {
      if (generation !== this.#generation) return {kind: 'stale'};
      return {kind: 'read-failed', message: message(error)};
    }
    if (generation !== this.#generation) return {kind: 'stale'};
    return this.#replace(source, 'import', confirm, generation);
  }

  async #replace(
    source: string,
    reason: DocumentReplacement['reason'],
    confirm: ConfirmDocumentReplacement,
    generation: number,
  ): Promise<DocumentReplacementResult> {
    try {
      parseProgram(source);
    } catch (error) {
      return {kind: 'invalid', message: message(error)};
    }
    if (this.#source.length > 0 && this.#source !== source) {
      let accepted: boolean;
      try {
        accepted = await confirm({source: this.#source, candidate: source, reason});
      } catch (error) {
        if (generation !== this.#generation) return {kind: 'stale'};
        return {kind: 'confirmation-failed', message: message(error)};
      }
      if (generation !== this.#generation) return {kind: 'stale'};
      if (!accepted) return {kind: 'cancelled'};
    }
    this.#source = source;
    this.#save();
    return {kind: 'replaced'};
  }

  #save(): void {
    if (!this.#storage) return;
    try {
      this.#storage.write(this.#source);
      this.#storageStatus = {kind: 'saved'};
    } catch (error) {
      this.#storageStatus = {kind: 'error', operation: 'save', message: message(error)};
    }
  }
}
