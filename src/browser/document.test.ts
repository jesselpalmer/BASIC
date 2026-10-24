import {expect, it, jest} from 'bun:test';
import {BrowserDocument, type DocumentStorage} from './document.ts';

function fixture(restored: string | null = null) {
  const storage = {
    read: jest.fn(() => restored),
    write: jest.fn<(source: string) => void>(),
  };
  const document = new BrowserDocument('10 PRINT "initial"', storage);
  const confirm = jest.fn(() => true);
  return {document, storage, confirm};
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}

it('keeps exact incomplete edits, autosaves them, and restores them without validation', () => {
  const f = fixture();
  expect(f.document.storageStatus).toEqual({kind: 'empty'});
  expect(f.document.source).toBe('10 PRINT "initial"');
  expect(f.storage.write).not.toHaveBeenCalled();
  const source = ' \r\n20 PRINT "unfinished\r\n10 GOTO 999\t\n';
  f.document.edit(source);
  expect(f.document.source).toBe(source);
  expect(f.document.exportSource()).toBe(source);
  expect(f.storage.write).toHaveBeenCalledWith(source);
  expect(f.document.storageStatus).toEqual({kind: 'saved'});
  const restored = fixture(source);
  expect(restored.document.source).toBe(source);
  expect(restored.document.storageStatus).toEqual({kind: 'restored'});
  expect(restored.storage.write).not.toHaveBeenCalled();
});

it('distinguishes an intentionally empty restored document from absent storage', () => {
  expect(fixture('').document.source).toBe('');
  expect(fixture('').document.storageStatus).toEqual({kind: 'restored'});
  const document = new BrowserDocument('initial');
  document.edit('changed');
  expect(document.source).toBe('changed');
  expect(document.storageStatus).toEqual({kind: 'unavailable'});
});

it.each([new Error('Storage denied'), new Error('Storage unavailable')])(
  'reports restoration failure and retains initial source: %j',
  (error) => {
    const storage: DocumentStorage = {
      read() {
        throw error;
      },
      write() {},
    };
    const document = new BrowserDocument('initial', storage);
    expect(document.source).toBe('initial');
    expect(document.storageStatus).toEqual({
      kind: 'error',
      operation: 'restore',
      message: error.message,
    });
    document.edit('new text');
    expect(document.storageStatus).toEqual({kind: 'saved'});
  },
);

it('retains editable text after save failure, reports it, and recovers on a later edit', () => {
  const f = fixture();
  f.storage.write.mockImplementationOnce(() => {
    throw new Error('Quota exceeded');
  });
  f.document.edit('10 PRINT "incomplete');
  expect(f.document.source).toBe('10 PRINT "incomplete');
  expect(f.document.storageStatus).toEqual({
    kind: 'error',
    operation: 'save',
    message: 'Quota exceeded',
  });
  const status = f.document.storageStatus;
  status.kind = 'empty';
  expect(f.document.storageStatus.kind).toBe('error');
  f.document.edit('10 END');
  expect(f.document.storageStatus).toEqual({kind: 'saved'});
});

it('requires confirmation for autosaved work and preserves everything on cancellation', async () => {
  const f = fixture();
  f.document.edit('20 PRINT "mine"\r\n');
  f.confirm.mockReturnValue(false);
  const before = f.document.storageStatus;
  const result = await f.document.replaceWithExample('10 END', f.confirm);
  expect(result).toEqual({kind: 'cancelled'});
  expect(f.confirm).toHaveBeenCalledWith({
    source: '20 PRINT "mine"\r\n',
    candidate: '10 END',
    reason: 'example',
  });
  expect(f.document.source).toBe('20 PRINT "mine"\r\n');
  expect(f.document.storageStatus).toEqual(before);
  expect(f.storage.write).toHaveBeenCalledTimes(1);
});

it('preserves source spelling and ordering when replacing with an approved example', async () => {
  const f = fixture();
  const source = '\r\n20 END\r\n10 print "hello"\r\n';
  expect(await f.document.replaceWithExample(source, f.confirm)).toEqual({kind: 'replaced'});
  expect(f.document.source).toBe(source);
  expect(f.storage.write).toHaveBeenCalledWith(source);
});

it('does not ask to replace an empty or identical document', async () => {
  const f = fixture('');
  expect(await f.document.replaceWithExample('10 END', f.confirm)).toEqual({kind: 'replaced'});
  expect(await f.document.importSource(() => Promise.resolve('10 END'), f.confirm)).toEqual({
    kind: 'replaced',
  });
  expect(f.confirm).not.toHaveBeenCalled();
});

it('protects even whitespace-only current text', async () => {
  const f = fixture(' \r\n');
  expect(await f.document.replaceWithExample('10 END', f.confirm)).toEqual({kind: 'replaced'});
  expect(f.confirm).toHaveBeenCalledTimes(1);
});

it('imports complete source exactly after confirmation and autosaves it', async () => {
  const f = fixture('incomplete');
  const source = '20 END\r\n10 PRINT "Imported"\r\n';
  expect(await f.document.importSource(() => Promise.resolve(source), f.confirm)).toEqual({
    kind: 'replaced',
  });
  expect(f.document.exportSource()).toBe(source);
  expect(f.storage.write).toHaveBeenCalledWith(source);
  expect(f.confirm).toHaveBeenCalledWith({
    source: 'incomplete',
    candidate: source,
    reason: 'import',
  });
});

it.each([
  '10 END\n10 PRINT "duplicate"',
  '10 END\n20 GOTO 999',
  '10 END\n20 FOR I=1 TO 2',
  '10 END\n20 NEXT I',
  '10 END\n20 PRINT "unfinished',
  '10 END\n20',
])('rejects malformed imports before confirmation and preserves work: %j', async (source) => {
  const f = fixture('my incomplete source');
  const status = f.document.storageStatus;
  const result = await f.document.importSource(() => Promise.resolve(source), f.confirm);
  expect(result.kind).toBe('invalid');
  expect(
    'message' in result && typeof result.message === 'string' && result.message.length > 0,
  ).toBe(true);
  expect(f.document.source).toBe('my incomplete source');
  expect(f.document.storageStatus).toEqual(status);
  expect(f.confirm).not.toHaveBeenCalled();
  expect(f.storage.write).not.toHaveBeenCalled();
});

it('rejects invalid examples and preserves current source', async () => {
  const f = fixture();
  expect(await f.document.replaceWithExample('invalid', f.confirm)).toMatchObject({
    kind: 'invalid',
  });
  expect(f.document.source).toBe('10 PRINT "initial"');
});

it('preserves source on failed reads, including synchronous failures', async () => {
  const f = fixture('current');
  expect(
    await f.document.importSource(() => Promise.reject(new Error('File unreadable')), f.confirm),
  ).toEqual({kind: 'read-failed', message: 'File unreadable'});
  expect(
    await f.document.importSource(() => {
      throw new Error('Read denied');
    }, f.confirm),
  ).toEqual({kind: 'read-failed', message: 'Read denied'});
  const failed = deferred<string>();
  failed.reject('Untyped failure');
  expect(await f.document.importSource(() => failed.promise, f.confirm)).toEqual({
    kind: 'read-failed',
    message: 'Untyped failure',
  });
  expect(f.document.source).toBe('current');
  expect(f.confirm).not.toHaveBeenCalled();
  expect(f.storage.write).not.toHaveBeenCalled();
});

it('preserves source when replacement confirmation fails', async () => {
  const f = fixture('current');
  expect(
    await f.document.replaceWithExample('10 END', () => Promise.reject(new Error('Dialog failed'))),
  ).toEqual({kind: 'confirmation-failed', message: 'Dialog failed'});
  expect(f.document.source).toBe('current');
  expect(f.storage.write).not.toHaveBeenCalled();
});

it('retains an approved imported source when autosave fails', async () => {
  const f = fixture('current');
  f.storage.write.mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(await f.document.importSource(() => Promise.resolve('10 END'), f.confirm)).toEqual({
    kind: 'replaced',
  });
  expect(f.document.source).toBe('10 END');
  expect(f.document.storageStatus).toEqual({
    kind: 'error',
    operation: 'save',
    message: 'Quota exceeded',
  });
});

it('keeps edits made during an import and does not prompt for stale text', async () => {
  const f = fixture('current');
  const read = deferred<string>();
  const pending = f.document.importSource(() => read.promise, f.confirm);
  f.document.edit('newest incomplete edit');
  read.resolve('10 END');
  expect(await pending).toEqual({kind: 'stale'});
  expect(f.document.source).toBe('newest incomplete edit');
  expect(f.confirm).not.toHaveBeenCalled();
  expect(f.storage.write).toHaveBeenCalledTimes(1);
});

it('consumes a stale read failure without changing the latest document', async () => {
  const f = fixture('current');
  const read = deferred<string>();
  const pending = f.document.importSource(() => read.promise, f.confirm);
  expect(await f.document.replaceWithExample('10 END', f.confirm)).toEqual({kind: 'replaced'});
  read.reject(new Error('Old file failed'));
  expect(await pending).toEqual({kind: 'stale'});
  expect(f.document.source).toBe('10 END');
});

it('keeps the newest import when reads finish out of order', async () => {
  const f = fixture('');
  const first = deferred<string>();
  const second = deferred<string>();
  const older = f.document.importSource(() => first.promise, f.confirm);
  const newer = f.document.importSource(() => second.promise, f.confirm);
  second.resolve('20 END');
  expect(await newer).toEqual({kind: 'replaced'});
  first.resolve('10 END');
  expect(await older).toEqual({kind: 'stale'});
  expect(f.document.source).toBe('20 END');
});

it.each([true, false])(
  'protects edits made while confirmation is pending (%j)',
  async (accepted) => {
    const f = fixture('current');
    const confirmation = deferred<boolean>();
    const pending = f.document.replaceWithExample('10 END', () => confirmation.promise);
    f.document.edit('newest');
    confirmation.resolve(accepted);
    expect(await pending).toEqual({kind: 'stale'});
    expect(f.document.source).toBe('newest');
  },
);

it('consumes stale confirmation failures and retains the replacement document', async () => {
  const f = fixture('current');
  const confirmation = deferred<boolean>();
  const older = f.document.replaceWithExample('10 END', () => confirmation.promise);
  expect(await f.document.replaceWithExample('20 END', f.confirm)).toEqual({kind: 'replaced'});
  confirmation.reject(new Error('Old dialog failed'));
  expect(await older).toEqual({kind: 'stale'});
  expect(f.document.source).toBe('20 END');
});

it('invalidates old reads even when a newer import is invalid or cancelled', async () => {
  const f = fixture('current');
  const first = deferred<string>();
  const older = f.document.importSource(() => first.promise, f.confirm);
  expect(await f.document.importSource(() => Promise.resolve('bad'), f.confirm)).toMatchObject({
    kind: 'invalid',
  });
  first.resolve('10 END');
  expect(await older).toEqual({kind: 'stale'});
  const second = deferred<string>();
  const pending = f.document.importSource(() => second.promise, f.confirm);
  expect(await f.document.replaceWithExample('20 END', () => false)).toEqual({kind: 'cancelled'});
  second.resolve('30 END');
  expect(await pending).toEqual({kind: 'stale'});
  expect(f.document.source).toBe('current');
});
