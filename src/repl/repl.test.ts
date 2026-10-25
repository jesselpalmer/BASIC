import {expect, it} from 'bun:test';
import {getEventListeners} from 'node:events';
import Repl from './repl.ts';
import {createHost} from '../core/host.ts';
import type {ProgramFiles} from './program_files.ts';
import type {InputOptions} from '../core/types.ts';

function session(entries: readonly (string | null)[], files?: ProgramFiles) {
  const output: string[] = [];
  const errors: string[] = [];
  const prompts: string[] = [];
  const remaining = [...entries];
  const host = {
    ...createHost({write: (text) => output.push(text)}),
    writeError: (text: string) => errors.push(text),
    readLine(prompt = '') {
      prompts.push(prompt);
      return Promise.resolve(remaining.shift() ?? null);
    },
  };
  return {repl: new Repl(host, files), host, output, errors, prompts, remaining};
}

it('edits incrementally, lists numeric order, and runs fresh snapshots repeatedly', async () => {
  const {repl, output, errors, prompts} = session([
    'LIST',
    '30 NEXT I',
    '10 GOTO 20',
    '20 FOR I=2 TO 1 STEP -1',
    '25 PRINT I',
    'LIST',
    'RUN',
    'RUN',
    '25 PRINT I*2',
    'RUN',
    '25',
    '25',
    'LIST',
    'NEW',
    'yes',
    'RUN',
    'LIST',
    'EXIT',
  ]);
  expect(await repl.start()).toBe(0);
  expect(output).toEqual([
    'BASIC 1.0.0\n',
    '10 GOTO 20\n20 FOR I=2 TO 1 STEP -1\n25 PRINT I\n30 NEXT I\n',
    '2\n',
    '1\n',
    '2\n',
    '1\n',
    '4\n',
    '2\n',
    '10 GOTO 20\n20 FOR I=2 TO 1 STEP -1\n30 NEXT I\n',
    'Have a great day :)\n',
  ]);
  expect(errors).toEqual([]);
  expect(prompts).toContain('Discard unsaved changes and start a new program? [y/N] ');
});

it('blank input and failed edits preserve source, and RUN validates before effects', async () => {
  const {repl, output, errors} = session([
    ' \t ',
    '30 PRINT "not yet"',
    '10 GOTO 20',
    'RUN',
    '20 FOR I=1 TO 2',
    'RUN',
    '20 PRINT "unfinished',
    'LIST',
    '20 PRINT "ready"',
    'RUN',
    'PRINT "unsupported immediate mode"',
    'RUN extra',
    'NEW',
    'y',
    'EXIT',
  ]);
  expect(await repl.start()).toBe(0);
  expect(output.filter((text) => text === 'not yet\n')).toEqual(['not yet\n']);
  expect(output).toContain('10 GOTO 20\n20 FOR I=1 TO 2\n30 PRINT "not yet"\n');
  expect(output).toContain('ready\n');
  expect(errors).toEqual([
    'Line 10, column 9: No line label 20\n',
    'Line 20, column 4: FOR has no matching NEXT\n',
    'Line 20, column 10: Unterminated string\n',
    'Unknown session command. Use RUN, LIST, NEW, LOAD, SAVE, or EXIT.\n',
    'Unknown session command. Use RUN, LIST, NEW, LOAD, SAVE, or EXIT.\n',
  ]);
});

it('NEW and EXIT require affirmative confirmation and preserve cancelled work', async () => {
  const {repl, output, errors, prompts} = session([
    '10 PRINT "preserved"',
    'NEW',
    '',
    'EXIT',
    'no',
    'LIST',
    'RUN',
    'EXIT',
    ' YeS ',
  ]);
  expect(await repl.start()).toBe(0);
  expect(output).toContain('10 PRINT "preserved"\n');
  expect(output).toContain('preserved\n');
  expect(errors).toEqual([]);
  expect(prompts.filter((text) => text.startsWith('Discard'))).toEqual([
    'Discard unsaved changes and start a new program? [y/N] ',
    'Discard unsaved changes and exit? [y/N] ',
    'Discard unsaved changes and exit? [y/N] ',
  ]);
});

it.each(['prompt', 'NEW', 'EXIT'])('recovers all unsaved source on EOF at %s', async (at) => {
  const entries = ['20 PRINT "last"', '10 PRINT "first"'];
  if (at !== 'prompt') entries.push(at);
  const {repl, output, errors} = session(entries);
  expect(await repl.start()).toBe(1);
  expect(errors).toEqual([
    'Unsaved program at EOF; copy the source below before closing:\n10 PRINT "first"\n20 PRINT "last"\n',
  ]);
  expect(output).toEqual(['BASIC 1.0.0\n', 'Have a great day :)\n']);
});

it('handles clean EOF, empty NEW, and deletion back to a clean program', async () => {
  for (const entries of [[], ['NEW'], ['10 END', '10']]) {
    const {repl, errors} = session(entries);
    expect(await repl.start()).toBe(0);
    expect(errors).toEqual([]);
  }
});

it('routes INPUT answers to the running program and clears variables for every RUN', async () => {
  const {repl, output, errors, prompts} = session([
    '10 INPUT "Text"; T$',
    '20 INPUT N',
    '30 PRINT T$;":";N',
    'RUN',
    'EXIT',
    'bad',
    '2',
    'RUN',
    'NEW',
    '-1',
    '10 PRINT T$',
    'RUN',
    'NEW',
    'yes',
    '10 PRINT T$',
    'RUN',
    'EXIT',
    'yes',
  ]);
  expect(await repl.start()).toBe(0);
  expect(output).toContain('EXIT:2\n');
  expect(output).toContain('NEW:-1\n');
  expect(prompts).toContain('Text? ');
  expect(output).toContain('Invalid number; please enter a finite decimal.\n');
  expect(errors).toEqual([
    'Line 10, column 10: Undefined variable T$\n',
    'Line 10, column 10: Undefined variable T$\n',
  ]);
});

it('reports runtime/input failures and preserves editable source for EOF recovery', async () => {
  const {repl, errors} = session(['10 INPUT N', '20 PRINT "skipped"', 'RUN']);
  expect(await repl.start()).toBe(1);
  expect(errors).toEqual([
    'Line 10, column 4: Input ended before a value was received\n',
    'Unsaved program at EOF; copy the source below before closing:\n10 INPUT N\n20 PRINT "skipped"\n',
  ]);
});

function waitable(files?: ProgramFiles) {
  const {host, ...captured} = session([], files);
  type Request = {
    prompt: string;
    signal: AbortSignal;
    resolve: (line: string | null) => void;
    reject: (error: Error) => void;
  };
  const requests: Request[] = [];
  const queued: Request[] = [];
  const waiting: ((request: Request) => void)[] = [];
  host.readLine = (prompt = '', {signal}: InputOptions = {}) =>
    new Promise<string | null>((resolve, reject) => {
      if (!signal) throw new Error('Expected cancellation signal');
      const onAbort = () => {
        const error = new Error('cancelled');
        error.name = 'AbortError';
        request.reject(error);
      };
      const request: Request = {
        prompt,
        signal,
        resolve(line) {
          signal.removeEventListener('abort', onAbort);
          resolve(line);
        },
        reject(error) {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      };
      signal.addEventListener('abort', onAbort, {once: true});
      if (signal.aborted) onAbort();
      requests.push(request);
      const ready = waiting.shift();
      if (ready) ready(request);
      else queued.push(request);
    });
  function nextRequest(): Promise<Request> {
    const request = queued.shift();
    return request ? Promise.resolve(request) : new Promise((resolve) => waiting.push(resolve));
  }
  return {requests, nextRequest, host, ...captured};
}

it('cancels only the idle entry and confirmation, then accepts a fresh command', async () => {
  const {repl, nextRequest, output, errors} = waitable();
  repl.interrupt();
  const result = repl.start();
  const entry = await nextRequest();
  expect(entry.prompt).toBe('>>> ');
  repl.interrupt();
  expect(entry.signal.aborted).toBe(true);
  (await nextRequest()).resolve('10 END');
  (await nextRequest()).resolve('EXIT');
  const confirmation = await nextRequest();
  expect(confirmation.prompt).toBe('Discard unsaved changes and exit? [y/N] ');
  repl.interrupt();
  expect(confirmation.signal.aborted).toBe(true);
  (await nextRequest()).resolve('LIST');
  (await nextRequest()).resolve('EXIT');
  (await nextRequest()).resolve('yes');
  expect(await result).toBe(0);
  expect(output).toContain('10 END\n');
  expect(errors).toEqual([]);
});

it('cancels pending program INPUT, keeps source, and supports a subsequent RUN', async () => {
  const {repl, nextRequest, output, errors} = waitable();
  const result = repl.start();
  (await nextRequest()).resolve('10 INPUT N$');
  (await nextRequest()).resolve('20 PRINT N$');
  (await nextRequest()).resolve('RUN');
  const input = await nextRequest();
  expect(input.prompt).toBe('? ');
  repl.interrupt();
  expect(input.signal.aborted).toBe(true);
  (await nextRequest()).resolve('RUN');
  (await nextRequest()).resolve('fresh');
  (await nextRequest()).resolve('EXIT');
  (await nextRequest()).resolve('yes');
  expect(await result).toBe(0);
  expect(output).toContain('fresh\n');
  expect(errors).toEqual([]);
});

it('propagates terminal read failures rather than retrying a failed host forever', async () => {
  const controller = new AbortController();
  const unrelated = () => {};
  controller.signal.addEventListener('abort', unrelated);
  const {repl, requests, nextRequest} = waitable();
  const result = repl.start({signal: controller.signal});
  const rejection = result.catch((error: unknown) => error);
  (await nextRequest()).reject(new Error('broken input'));
  expect(await rejection).toMatchObject({message: 'broken input'});
  expect(requests).toHaveLength(1);
  expect(getEventListeners(controller.signal, 'abort')).toEqual([unrelated]);
});

it('external cancellation aborts the session and detaches the external signal listener', async () => {
  const controller = new AbortController();
  const unrelated = () => {};
  controller.signal.addEventListener('abort', unrelated);
  const {repl, nextRequest} = waitable();
  const result = repl.start({signal: controller.signal});
  const rejection = result.catch((error: unknown) => error);
  const request = await nextRequest();
  controller.abort();
  expect(request.signal.aborted).toBe(true);
  expect(await rejection).toMatchObject({name: 'AbortError'});
  expect(getEventListeners(controller.signal, 'abort')).toEqual([unrelated]);
  const already = new AbortController();
  already.abort();
  expect(await repl.start({signal: already.signal}).catch((error: unknown) => error)).toMatchObject(
    {
      name: 'AbortError',
    },
  );
  expect(getEventListeners(already.signal, 'abort')).toEqual([]);
});

it.each([
  {ending: 'EXIT', entries: ['EXIT'], status: 0},
  {ending: 'clean EOF', entries: [], status: 0},
  {ending: 'dirty EOF', entries: ['10 END'], status: 1},
])('detaches its external signal listener after $ending', async ({entries, status}) => {
  const controller = new AbortController();
  const unrelated = () => {};
  controller.signal.addEventListener('abort', unrelated);
  const {repl} = session(entries);
  expect(await repl.start({signal: controller.signal})).toBe(status);
  expect(getEventListeners(controller.signal, 'abort')).toEqual([unrelated]);
});

it('does not let a completed session signal interrupt a later session', async () => {
  const previous = new AbortController();
  const current = new AbortController();
  const {repl, nextRequest, errors} = waitable();
  const first = repl.start({signal: previous.signal});
  (await nextRequest()).resolve('EXIT');
  expect(await first).toBe(0);

  const second = repl.start({signal: current.signal});
  try {
    const entry = await nextRequest();
    previous.abort();
    expect(entry.signal.aborted).toBe(false);
    entry.resolve('EXIT');
    expect(await second).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    current.abort();
    await second.catch(() => {});
  }
});

it('discards an already-resolved entry when interrupted before it is consumed', async () => {
  const {repl, errors, prompts} = session(['10 END', 'EXIT']);
  const result = repl.start();
  repl.interrupt();
  expect(await result).toBe(0);
  expect(errors).toEqual([]);
  expect(prompts).toEqual(['>>> ', '>>> ']);
});

it('external cancellation ends a dirty confirmation without interpreting later input', async () => {
  const controller = new AbortController();
  const {repl, nextRequest} = waitable();
  const result = repl.start({signal: controller.signal});
  const rejection = result.catch((error: unknown) => error);
  (await nextRequest()).resolve('10 END');
  (await nextRequest()).resolve('EXIT');
  const confirmation = await nextRequest();
  expect(confirmation.prompt).toBe('Discard unsaved changes and exit? [y/N] ');
  controller.abort();
  expect(confirmation.signal.aborted).toBe(true);
  expect(await rejection).toMatchObject({name: 'AbortError'});
});

function memoryFiles(initial: Readonly<Record<string, string>> = {}) {
  const contents = new Map(Object.entries(initial));
  const writes: string[] = [];
  const files: ProgramFiles = {
    read: (path) => Promise.resolve(contents.get(path) ?? ''),
    exists: (path) => Promise.resolve(contents.has(path)),
    prepareSave: (path, source) =>
      Promise.resolve({
        commit() {
          writes.push(path);
          contents.set(path, source);
        },
        discard: () => Promise.resolve(),
      }),
  };
  return {files, contents, writes};
}

it('loads and saves quoted paths with spaces, literal quotes, and original case across sessions', async () => {
  const {files, contents, writes} = memoryFiles();
  const first = session(
    [
      '20 END',
      '10 PRINT "round trip"',
      'sAvE "My ""Quoted"" Program.bas"',
      '10 PRINT "cancelled"',
      'SAVE',
      'no',
      '10 PRINT "round trip"',
      'EXIT',
    ],
    files,
  );
  expect(await first.repl.start()).toBe(0);
  expect(first.errors).toEqual([]);
  expect(writes).toEqual(['My "Quoted" Program.bas']);
  expect(contents.get('My "Quoted" Program.bas')).toBe('10 PRINT "round trip"\n20 END');
  expect(first.prompts).toContain('Overwrite "My \\"Quoted\\" Program.bas"? [y/N] ');

  const second = session(
    [
      'load "My ""Quoted"" Program.bas"',
      'LIST',
      'RUN',
      '20 REM changed',
      'SAVE',
      ' YES ',
      'NEW',
      'SAVE',
      'EXIT',
    ],
    files,
  );
  expect(await second.repl.start()).toBe(0);
  expect(second.output).toContain('10 PRINT "round trip"\n20 END\n');
  expect(second.output).toContain('round trip\n');
  expect(second.errors).toEqual(['SAVE requires a quoted filename before the first save\n']);
  expect(second.prompts.filter((prompt) => prompt.startsWith('Discard'))).toEqual([]);
  expect(contents.get('My "Quoted" Program.bas')).toBe('10 PRINT "round trip"\n20 REM changed');
});

it('reports unavailable file capabilities and malformed paths without changing source', async () => {
  const s = session([
    '10 END',
    'SAVE "file.bas"',
    'LOAD "file.bas"',
    'SAVE file.bas',
    'LIST',
    'EXIT',
    'yes',
  ]);
  expect(await s.repl.start()).toBe(0);
  expect(s.output).toContain('10 END\n');
  expect(s.errors).toEqual([
    'Program files are unavailable in this host\n',
    'Program files are unavailable in this host\n',
    'SAVE requires a nonempty quoted filename, with no trailing arguments\n',
  ]);
});

it.each(['LOAD', 'SAVE'])(
  'EOF cancels %s confirmation and preserves dirty source for recovery',
  async (kind) => {
    const {files, contents, writes} = memoryFiles({'target.bas': '30 END'});
    const s = session(['10 PRINT "retained"', `${kind} "target.bas"`], files);
    expect(await s.repl.start()).toBe(1);
    expect(s.errors).toEqual([
      'Unsaved program at EOF; copy the source below before closing:\n10 PRINT "retained"\n',
    ]);
    expect(contents.get('target.bas')).toBe('30 END');
    expect(writes).toEqual([]);
  },
);

it.each(['LOAD', 'SAVE'])(
  'Ctrl+C cancels %s confirmation and permits a new command',
  async (kind) => {
    const {files, contents, writes} = memoryFiles({'target.bas': '30 END'});
    const s = waitable(files);
    const result = s.repl.start();
    (await s.nextRequest()).resolve('10 PRINT "retained"');
    (await s.nextRequest()).resolve(`${kind} "target.bas"`);
    const confirmation = await s.nextRequest();
    expect(confirmation.prompt).not.toBe('>>> ');
    s.repl.interrupt();
    (await s.nextRequest()).resolve('LIST');
    (await s.nextRequest()).resolve('EXIT');
    (await s.nextRequest()).resolve('yes');
    expect(await result).toBe(0);
    expect(s.errors).toEqual([]);
    expect(s.output).toContain('10 PRINT "retained"\n');
    expect(contents.get('target.bas')).toBe('30 END');
    expect(writes).toEqual([]);
  },
);

it('reports a postcommit cleanup warning while retaining a successful clean save', async () => {
  const {files, contents} = memoryFiles();
  files.prepareSave = (path, source) =>
    Promise.resolve({
      commit() {
        contents.set(path, source);
        return 'Saved file.bas, but could not remove temporary file';
      },
      discard: () => Promise.resolve(),
    });
  const s = session(['10 END', 'SAVE "file.bas"', 'EXIT'], files);
  expect(await s.repl.start()).toBe(0);
  expect(contents.get('file.bas')).toBe('10 END');
  expect(s.errors).toEqual(['Saved file.bas, but could not remove temporary file\n']);
  expect(s.prompts.filter((prompt) => prompt.startsWith('Discard'))).toEqual([]);
});

it('does not report cancellation after a save has crossed its commit boundary', async () => {
  const {files, contents} = memoryFiles();
  const s = session(['10 END', 'SAVE "file.bas"', 'EXIT'], files);
  files.prepareSave = (path, source) =>
    Promise.resolve({
      commit() {
        contents.set(path, source);
        s.repl.interrupt();
      },
      discard: () => Promise.resolve(),
    });
  expect(await s.repl.start()).toBe(0);
  expect(contents.get('file.bas')).toBe('10 END');
  expect(s.errors).toEqual([]);
  expect(s.output).toEqual(['BASIC 1.0.0\n', 'Have a great day :)\n']);
});
