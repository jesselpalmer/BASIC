import {afterEach, beforeEach, expect, it, jest} from 'bun:test';
import {
  promises as fs,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as nodeFs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import NodeProgramFiles from './program_files.ts';

let directory: string;
const files = new NodeProgramFiles();

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'basic-files-'));
});

afterEach(() => {
  rmSync(directory, {recursive: true, force: true});
});

it('reads literal paths, distinguishes absent files, and detects dangling symlinks', async () => {
  const path = join(directory, 'MiXeD "spaced" file.bas');
  expect(await files.exists(path, {})).toBe(false);
  writeFileSync(path, '20 END\r\n10 PRINT "literal"\r\n');
  expect(await files.exists(path, {})).toBe(true);
  expect(await files.read(path, {})).toBe('20 END\r\n10 PRINT "literal"\r\n');
  const link = join(directory, 'dangling.bas');
  await fs.symlink(join(directory, 'absent.bas'), link);
  expect(await files.exists(link, {})).toBe(true);
  expect(await files.read(link, {}).catch((error: unknown) => error)).toMatchObject({
    code: 'ENOENT',
  });
});

it('propagates existence failures instead of treating them as a new destination', async () => {
  const stat = jest.spyOn(fs, 'lstat').mockRejectedValueOnce(new Error('Denied'));
  try {
    expect(await files.exists('anything', {}).catch((error: unknown) => error)).toMatchObject({
      message: 'Denied',
    });
  } finally {
    stat.mockRestore();
  }
  const failed = jest.spyOn(fs, 'lstat').mockRejectedValueOnce('unusual failure');
  try {
    expect(await files.exists('anything', {}).catch((error: unknown) => error)).toBe(
      'unusual failure',
    );
  } finally {
    failed.mockRestore();
  }
});

it('writes a temporary beside the destination and replaces only at synchronous commit', async () => {
  const path = join(directory, 'Program With Spaces.bas');
  writeFileSync(path, 'original');
  const write = await files.prepareSave(path, '10 GOTO 999\n20 FOR I=1 TO 2', {});
  const staged = readdirSync(directory).filter((name) => name !== 'Program With Spaces.bas');
  expect(staged).toHaveLength(1);
  expect(readFileSync(join(directory, staged[0]), 'utf8')).toBe('10 GOTO 999\n20 FOR I=1 TO 2');
  expect(readFileSync(path, 'utf8')).toBe('original');
  write.commit(true);
  expect(readFileSync(path, 'utf8')).toBe('10 GOTO 999\n20 FOR I=1 TO 2');
  await write.discard();
  expect(readdirSync(directory)).toEqual(['Program With Spaces.bas']);
});

it('supports empty source, absent destinations, and maximum-length filenames', async () => {
  const name = 'a'.repeat(251) + '.bas';
  const path = join(directory, name);
  const write = await files.prepareSave(path, '', {});
  write.commit(false);
  expect(readFileSync(path, 'utf8')).toBe('');
  expect(readdirSync(directory)).toEqual([name]);
});

it('discards an abandoned staged write without changing the prior destination', async () => {
  const path = join(directory, 'original.bas');
  writeFileSync(path, 'original');
  const write = await files.prepareSave(path, 'replacement', {});
  await write.discard();
  await write.discard();
  expect(readFileSync(path, 'utf8')).toBe('original');
  expect(readdirSync(directory)).toEqual(['original.bas']);
});

it('retains a destination when replacement fails and permits temporary cleanup', async () => {
  const path = join(directory, 'existing-directory');
  await fs.mkdir(path);
  writeFileSync(join(path, 'retained.bas'), 'original');
  const write = await files.prepareSave(path, 'replacement', {});
  expect(() => write.commit(true)).toThrow();
  await write.discard();
  expect(readFileSync(join(path, 'retained.bas'), 'utf8')).toBe('original');
  expect(readdirSync(directory)).toEqual(['existing-directory']);
});

it('preserves destination and cleans partial temporary contents on write failure', async () => {
  const path = join(directory, 'original.bas');
  writeFileSync(path, 'original');
  const realOpen = fs.open.bind(fs);
  const open = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await realOpen(...args);
    const realWrite = handle.writeFile.bind(handle);
    jest.spyOn(handle, 'writeFile').mockImplementation(async () => {
      await realWrite('partial');
      throw new Error('Disk full');
    });
    return handle;
  });
  try {
    expect(
      await files.prepareSave(path, 'replacement', {}).catch((error: unknown) => error),
    ).toMatchObject({message: 'Disk full'});
  } finally {
    open.mockRestore();
  }
  expect(readFileSync(path, 'utf8')).toBe('original');
  expect(readdirSync(directory)).toEqual(['original.bas']);
});

it('cleans a fully written temporary if close fails before commit', async () => {
  const path = join(directory, 'original.bas');
  writeFileSync(path, 'original');
  const realOpen = fs.open.bind(fs);
  const open = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await realOpen(...args);
    const realClose = handle.close.bind(handle);
    jest.spyOn(handle, 'close').mockImplementation(async () => {
      await realClose();
      throw new Error('Close failed');
    });
    return handle;
  });
  try {
    expect(
      await files.prepareSave(path, 'replacement', {}).catch((error: unknown) => error),
    ).toMatchObject({message: 'Close failed'});
  } finally {
    open.mockRestore();
  }
  expect(readFileSync(path, 'utf8')).toBe('original');
  expect(readdirSync(directory)).toEqual(['original.bas']);
});

it('cleans the temporary when cancellation arrives after writing but before commit', async () => {
  const path = join(directory, 'original.bas');
  writeFileSync(path, 'original');
  const controller = new AbortController();
  const realOpen = fs.open.bind(fs);
  const open = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await realOpen(...args);
    const realClose = handle.close.bind(handle);
    jest.spyOn(handle, 'close').mockImplementation(async () => {
      await realClose();
      controller.abort();
    });
    return handle;
  });
  try {
    expect(
      await files
        .prepareSave(path, 'replacement', {signal: controller.signal})
        .catch((error: unknown) => error),
    ).toMatchObject({
      name: 'AbortError',
    });
  } finally {
    open.mockRestore();
  }
  expect(readFileSync(path, 'utf8')).toBe('original');
  expect(readdirSync(directory)).toEqual(['original.bas']);
});

it('rejects already-cancelled effects and creation failures without leaving temporary files', async () => {
  const controller = new AbortController();
  controller.abort();
  const options = {signal: controller.signal};
  const path = join(directory, 'cancelled.bas');
  expect(await files.read(path, options).catch((error: unknown) => error)).toMatchObject({
    name: 'AbortError',
  });
  expect(await files.exists(path, options).catch((error: unknown) => error)).toMatchObject({
    name: 'AbortError',
  });
  expect(
    await files.prepareSave(path, '10 END', options).catch((error: unknown) => error),
  ).toMatchObject({
    name: 'AbortError',
  });
  expect(
    await files
      .prepareSave(join(directory, 'absent', 'file.bas'), '', {})
      .catch((error: unknown) => error),
  ).toMatchObject({
    code: 'ENOENT',
  });
  expect(readdirSync(directory)).toEqual([]);
});

it('refuses to clobber a destination created by another writer during preparation', async () => {
  const path = join(directory, 'racing.bas');
  expect(await files.exists(path, {})).toBe(false);
  const write = await files.prepareSave(path, 'our program', {});
  writeFileSync(path, 'competing program');
  expect(() => write.commit(false)).toThrow();
  await write.discard();
  expect(readFileSync(path, 'utf8')).toBe('competing program');
  expect(readdirSync(directory)).toEqual(['racing.bas']);
});

it('reports temporary cleanup failure after exclusive installation as a saved-file warning', async () => {
  const path = join(directory, 'installed.bas');
  const write = await files.prepareSave(path, '10 END', {});
  const unlink = jest.spyOn(nodeFs, 'unlinkSync').mockImplementation(() => {
    throw new Error('Cleanup denied');
  });
  let warning: string | void;
  try {
    warning = write.commit(false);
  } finally {
    unlink.mockRestore();
  }
  expect(warning).toContain('Saved');
  expect(warning).toContain('Cleanup denied');
  expect(warning).toContain('.tmp');
  expect(readFileSync(path, 'utf8')).toBe('10 END');
  await write.discard();
  expect(readdirSync(directory)).toHaveLength(2);
});

it('normalizes a non-Error cleanup failure after successful installation', async () => {
  const path = join(directory, 'installed.bas');
  const write = await files.prepareSave(path, '', {});
  const unlink = jest.spyOn(nodeFs, 'unlinkSync').mockImplementation(() => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- Verify untyped filesystem failures.
    throw 'cleanup failed';
  });
  try {
    expect(write.commit(false)).toContain('cleanup failed');
  } finally {
    unlink.mockRestore();
  }
  expect(readFileSync(path, 'utf8')).toBe('');
});

it('replaces an approved symlink itself without modifying the linked program', async () => {
  const target = join(directory, 'target.bas');
  const alias = join(directory, 'alias.bas');
  writeFileSync(target, 'original target');
  await fs.symlink(target, alias);
  const write = await files.prepareSave(alias, 'new program', {});
  write.commit(true);
  expect(readFileSync(alias, 'utf8')).toBe('new program');
  expect(readFileSync(target, 'utf8')).toBe('original target');
  expect((await fs.lstat(alias)).isSymbolicLink()).toBe(false);
  expect((await fs.readdir(directory)).sort()).toEqual(['alias.bas', 'target.bas']);
});
