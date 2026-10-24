import {expect, it, jest} from 'bun:test';
import {parseProgram} from '../parser/parser.ts';
import StoredProgram from './program.ts';
import ProgramPersistence from './persistence.ts';
import type {ProgramFiles, ProgramWrite} from './program_files.ts';

function fixture() {
  const source = new StoredProgram();
  source.replace(parseProgram('10 PRINT "original"'), 'Original.bas');
  const destinations = new Map([['Original.bas', source.source]]);
  const commit = jest.fn();
  const discard = jest.fn(() => Promise.resolve());
  const files: ProgramFiles = {
    read: jest.fn((path: string) => {
      const text = destinations.get(path);
      return text === undefined ? Promise.reject(new Error('Unreadable')) : Promise.resolve(text);
    }),
    exists: jest.fn((path: string) => Promise.resolve(destinations.has(path))),
    prepareSave: jest.fn((path: string, text: string) => {
      commit.mockImplementation(() => {
        destinations.set(path, text);
      });
      return Promise.resolve({commit, discard});
    }),
  };
  const persistence = new ProgramPersistence(source, files);
  const controller = new AbortController();
  const confirm = jest.fn(() => Promise.resolve(true));
  const state = () => ({source: source.source, dirty: source.dirty, filename: source.filename});
  const execute = (kind: 'LOAD' | 'SAVE', path?: string) =>
    persistence.execute(
      kind === 'LOAD' ? {kind, path: path!} : {kind, path},
      confirm,
      controller.signal,
    );
  return {source, destinations, files, commit, discard, controller, confirm, state, execute};
}

it('loads a completely validated candidate in numeric order without executing it', async () => {
  const f = fixture();
  f.destinations.set('Mixed Path.bas', '20 END\r\n10 PRINT UNKNOWN\r\n');
  await f.execute('LOAD', 'Mixed Path.bas');
  expect(f.state()).toEqual({
    source: '10 PRINT UNKNOWN\n20 END',
    filename: 'Mixed Path.bas',
    dirty: false,
  });
  expect(f.confirm).not.toHaveBeenCalled();
  f.destinations.set('empty.bas', '\r\n\n');
  await f.execute('LOAD', 'empty.bas');
  expect(f.state()).toEqual({source: '', filename: 'empty.bas', dirty: false});
});

it.each([
  '10 END\n10 PRINT "duplicate"',
  '10 END\n20 GOTO 999',
  '10 END\n20 FOR I=1 TO 2',
  '10 END\n20 NEXT I',
  '10 END\n20 PRINT "unfinished',
  '10 END\n20',
])('rejects every invalid candidate before asking to discard edits: %j', async (text) => {
  const f = fixture();
  f.source.edit('20 REM unsaved');
  const before = f.state();
  f.destinations.set('bad.bas', text);
  expect(await f.execute('LOAD', 'bad.bas').catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(f.state()).toEqual(before);
  expect(f.confirm).not.toHaveBeenCalled();
});

it('preserves all session state on read failure or refused discard, and accepts confirmation', async () => {
  const f = fixture();
  f.source.edit('20 REM unsaved');
  const before = f.state();
  expect(await f.execute('LOAD', 'missing.bas').catch((error: unknown) => error)).toMatchObject({
    message: 'Unreadable',
  });
  expect(f.state()).toEqual(before);
  f.confirm.mockResolvedValue(false);
  f.destinations.set('Next.bas', '30 END');
  await f.execute('LOAD', 'Next.bas');
  expect(f.state()).toEqual(before);
  f.confirm.mockResolvedValue(true);
  await f.execute('LOAD', 'Next.bas');
  expect(f.state()).toEqual({source: '30 END', filename: 'Next.bas', dirty: false});
});

it('saves incomplete edits in source order, tracks SAVE AS, and confirms current-file overwrite', async () => {
  const f = fixture();
  f.source.edit('30 FOR I=1 TO 2');
  f.source.edit('20 GOTO 999');
  await f.execute('SAVE', 'New File.bas');
  expect(f.destinations.get('New File.bas')).toBe(
    '10 PRINT "original"\n20 GOTO 999\n30 FOR I=1 TO 2',
  );
  expect(f.state()).toEqual({source: f.source.source, filename: 'New File.bas', dirty: false});
  expect(f.confirm).not.toHaveBeenCalled();
  f.source.edit('30');
  f.confirm.mockResolvedValue(false);
  const before = f.state();
  const saved = f.destinations.get('New File.bas');
  await f.execute('SAVE');
  expect(f.state()).toEqual(before);
  expect(f.destinations.get('New File.bas')).toBe(saved);
  expect(f.confirm).toHaveBeenCalledWith('Overwrite "New File.bas"? [y/N] ', f.controller.signal);
  f.confirm.mockResolvedValue(true);
  await f.execute('SAVE');
  expect(f.destinations.get('New File.bas')).toBe('10 PRINT "original"\n20 GOTO 999');
  expect(f.source.dirty).toBe(false);
  expect(f.discard).not.toHaveBeenCalled();
});

it('rejects SAVE without a filename and preserves state on preparation or commit failure', async () => {
  const f = fixture();
  f.source.clear();
  expect(await f.execute('SAVE').catch((error: unknown) => error)).toMatchObject({
    message: 'SAVE requires a quoted filename before the first save',
  });
  f.source.edit('10 END');
  f.files.prepareSave = () => Promise.reject(new Error('Write failed'));
  const before = f.state();
  expect(await f.execute('SAVE', 'Other.bas').catch((error: unknown) => error)).toMatchObject({
    message: 'Write failed',
  });
  expect(f.state()).toEqual(before);
  f.files.prepareSave = () =>
    Promise.resolve({
      commit: () => {
        throw new Error('Replace failed');
      },
      discard: f.discard,
    });
  expect(await f.execute('SAVE', 'Original.bas').catch((error: unknown) => error)).toMatchObject({
    message: 'Replace failed',
  });
  expect(f.state()).toEqual(before);
  expect(f.destinations.get('Original.bas')).toBe('10 PRINT "original"');
  expect(f.discard).toHaveBeenCalledTimes(1);
});

it.each(['read', 'exists', 'confirm-load', 'confirm-save', 'prepare'])(
  'cancels before committing when interrupted during %s',
  async (at) => {
    const f = fixture();
    f.source.edit('20 REM unsaved');
    const before = f.state();
    const interrupt = <T>(value: T) => {
      f.controller.abort();
      return Promise.resolve(value);
    };
    if (at === 'read') f.files.read = () => interrupt('30 END');
    if (at === 'exists') f.files.exists = () => interrupt(false);
    if (at.startsWith('confirm')) f.confirm.mockImplementation(() => interrupt(true));
    if (at === 'prepare') {
      f.files.prepareSave = () => interrupt<ProgramWrite>({commit: f.commit, discard: f.discard});
    }
    expect(
      await (
        at === 'read' || at === 'confirm-load'
          ? f.execute('LOAD', 'Original.bas')
          : f.execute('SAVE')
      ).catch((error: unknown) => error),
    ).toMatchObject({name: 'AbortError'});
    expect(f.state()).toEqual(before);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.destinations.get('Original.bas')).toBe('10 PRINT "original"');
    expect(f.discard).toHaveBeenCalledTimes(at === 'prepare' ? 1 : 0);
  },
);

it('commits source and filename together even if an interrupt arrives at the commit boundary', async () => {
  const f = fixture();
  f.source.edit('20 END');
  f.files.prepareSave = (path, text) =>
    Promise.resolve({
      commit() {
        f.destinations.set(path, text);
        f.controller.abort();
      },
      discard: f.discard,
    });
  await f.execute('SAVE', 'Committed.bas');
  expect(f.state()).toEqual({source: f.source.source, filename: 'Committed.bas', dirty: false});
  expect(f.destinations.get('Committed.bas')).toBe(f.source.source);
  expect(f.discard).not.toHaveBeenCalled();
});

it.each([
  {operation: 'read', late: 'value'},
  {operation: 'read', late: 'failure'},
  {operation: 'exists', late: 'value'},
  {operation: 'exists', late: 'failure'},
])(
  'settles cancellation of ignored-signal $operation and consumes its late $late',
  async ({operation, late}) => {
    const f = fixture();
    f.source.edit('20 REM unsaved');
    const before = f.state();
    const read = Promise.withResolvers<string>();
    const exists = Promise.withResolvers<boolean>();
    f.files.read = () => read.promise;
    f.files.exists = () => exists.promise;
    const pending = operation === 'read' ? read : exists;
    const result = (
      operation === 'read' ? f.execute('LOAD', 'Original.bas') : f.execute('SAVE')
    ).catch((error: unknown) => error);
    f.controller.abort();
    expect(await result).toMatchObject({name: 'AbortError'});
    expect(f.state()).toEqual(before);
    expect(f.confirm).not.toHaveBeenCalled();
    expect(f.commit).not.toHaveBeenCalled();
    if (late === 'value') {
      if (operation === 'read') read.resolve('30 END');
      else exists.resolve(false);
    } else {
      pending.reject(new Error('Late file failure'));
    }
    await pending.promise.catch(() => {});
    expect(f.state()).toEqual(before);
    expect(f.destinations.get('Original.bas')).toBe('10 PRINT "original"');
  },
);
