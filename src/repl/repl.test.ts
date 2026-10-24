import {expect, it} from 'bun:test';
import Repl from './repl.ts';
import {createHost} from '../core/host.ts';
import type {InputOptions} from '../core/types.ts';

function session(entries: (string | null)[]) {
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
  return {repl: new Repl(host), host, output, errors, prompts, remaining};
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
    'BASIC 0.0.10\n',
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
    'Unknown session command. Use RUN, LIST, NEW, or EXIT.\n',
    'Unknown session command. Use RUN, LIST, NEW, or EXIT.\n',
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
  expect(output).toEqual(['BASIC 0.0.10\n', 'Have a great day :)\n']);
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

function waitable() {
  const {repl: _repl, host, ...captured} = session([]);
  void _repl;
  const requests: {
    prompt: string;
    signal: AbortSignal;
    resolve: (line: string | null) => void;
    reject: (error: Error) => void;
  }[] = [];
  host.readLine = (prompt = '', {signal}: InputOptions = {}) =>
    new Promise<string | null>((resolve, reject) => {
      if (!signal) throw new Error('Expected cancellation signal');
      const onAbort = () => {
        const error = new Error('cancelled');
        error.name = 'AbortError';
        reject(error);
      };
      signal.addEventListener('abort', onAbort, {once: true});
      requests.push({prompt, signal, resolve, reject});
    });
  const repl = new Repl(host);
  const tick = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  return {repl, requests, tick, host, ...captured};
}

it('cancels only the idle entry and confirmation, then accepts a fresh command', async () => {
  const {repl, requests, output, errors, tick} = waitable();
  repl.interrupt();
  const result = repl.start();
  repl.interrupt();
  await tick();
  expect(requests[0].signal.aborted).toBe(true);
  requests[1].resolve('10 END');
  await tick();
  requests[2].resolve('EXIT');
  await tick();
  expect(requests[3].prompt).toBe('Discard unsaved changes and exit? [y/N] ');
  repl.interrupt();
  await tick();
  requests[4].resolve('LIST');
  await tick();
  requests[5].resolve('EXIT');
  await tick();
  requests[6].resolve('yes');
  expect(await result).toBe(0);
  expect(output).toContain('10 END\n');
  expect(errors).toEqual([]);
});

it('cancels pending program INPUT, keeps source, and supports a subsequent RUN', async () => {
  const {repl, requests, output, errors, tick} = waitable();
  const result = repl.start();
  requests[0].resolve('10 INPUT N$');
  await tick();
  requests[1].resolve('20 PRINT N$');
  await tick();
  requests[2].resolve('RUN');
  await tick();
  expect(requests[3].prompt).toBe('? ');
  repl.interrupt();
  await tick();
  requests[4].resolve('RUN');
  await tick();
  requests[5].resolve('fresh');
  await tick();
  requests[6].resolve('EXIT');
  await tick();
  requests[7].resolve('yes');
  expect(await result).toBe(0);
  expect(output).toContain('fresh\n');
  expect(errors).toEqual([]);
});

it('propagates terminal read failures rather than retrying a failed host forever', async () => {
  const {repl, requests, tick} = waitable();
  const result = repl.start();
  const rejection = result.catch((error: unknown) => error);
  requests[0].reject(new Error('broken input'));
  await tick();
  expect(await rejection).toMatchObject({message: 'broken input'});
  expect(requests).toHaveLength(1);
});

it('external cancellation aborts the session and detaches the external signal listener', async () => {
  const controller = new AbortController();
  const {repl, requests, tick} = waitable();
  const result = repl.start({signal: controller.signal});
  const rejection = result.catch((error: unknown) => error);
  controller.abort();
  await tick();
  expect(requests[0].signal.aborted).toBe(true);
  expect(await rejection).toMatchObject({name: 'AbortError'});
  const already = new AbortController();
  already.abort();
  expect(await repl.start({signal: already.signal}).catch((error: unknown) => error)).toMatchObject(
    {
      name: 'AbortError',
    },
  );
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
  const {repl, requests, tick} = waitable();
  const result = repl.start({signal: controller.signal});
  const rejection = result.catch((error: unknown) => error);
  requests[0].resolve('10 END');
  await tick();
  requests[1].resolve('EXIT');
  await tick();
  controller.abort();
  await tick();
  expect(requests[2].signal.aborted).toBe(true);
  expect(await rejection).toMatchObject({name: 'AbortError'});
});
