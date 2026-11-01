import {expect, test} from 'bun:test';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseLine, parseProgram} from '../index.ts';
import type {Host, Program} from './types.ts';

function setup(answers: (string | null)[] = [], host: Partial<Host> = {}) {
  const prompts: string[] = [],
    output: string[] = [];
  const b = new Basic({
    write: (t) => output.push(t),
    readLine: (p) => {
      prompts.push(p ?? '');
      return Promise.resolve(answers.shift() ?? null);
    },
    ...host,
  });
  return {b, prompts, output};
}
test.each([
  '',
  '  spaces  ',
  'a,b,"quoted"',
  '""',
  '123',
  'λ😀',
  'a\r\nb',
  '\0\xff',
  'x'.repeat(65536),
])('INPUT LINE preserves one exact raw response', async (text) => {
  const f = setup([text]);
  await f.b.runAsync('10 INPUT LINE S$');
  expect(f.prompts).toEqual(['']);
  expect(f.output).toEqual([]);
  expect(f.b.variables[0].value).toBe(text);
});
test('uses indexed strings, sequences and call continuations with fresh runs', async () => {
  const f = setup(['first, raw', 'second', 'third']);
  const source = '10 DIM S$(1):GOSUB 100:PRINT S$(1):END\n100 INPUT LINE S$(1):RETURN';
  await f.b.runAsync(source);
  await f.b.runAsync();
  expect(f.output).toEqual(['first, raw\n', 'second\n']);
  await f.b.runAsync('10 IF 1=1 THEN INPUT LINE A$ ELSE PRINT "never"\n20 PRINT A$');
  expect(f.output.at(-1)).toBe('third\n');
});
test('assigns a raw response to a two-dimensional string array element', async () => {
  const f = setup([' x,y ']);
  await f.b.runAsync('10 DIM A$(1,1):INPUT LINE A$(1,0)');
  expect(f.b.arrays[0].values).toEqual(['', '', ' x,y ', '']);
  expect(f.prompts).toEqual(['']);
});
test('does not change ordinary INPUT prompts, raw scalar strings, numeric retry or LINE$ names', async () => {
  const f = setup([' x,y ', 'raw', 'oops', '4']);
  await f.b.runAsync('10 INPUT LINE$\n20 INPUT "Say";S$\n30 INPUT N');
  expect(f.prompts).toEqual(['? ', 'Say? ', '? ', '? ']);
  expect(f.b.variables).toEqual([
    {name: 'LINE$', value: ' x,y '},
    {name: 'S$', value: 'raw'},
    {name: 'N', value: 4},
  ]);
  expect(f.output).toEqual(['Invalid number; please enter a finite decimal.\n']);
  expect(parseLine('10 INPUT LINE$')!.statement.type).toBe('InputStatement');
});
test.each([
  '10 INPUT LINE N',
  '10 INPUT LINE "prompt";S$',
  '10 INPUT LINE S$,T$',
  '10 INPUT LINE #1,S$',
  '10 INPUT LINE S$;',
  '10 LINPUT S$',
  '10 LINE INPUT S$',
])('rejects unsupported INPUT LINE syntax %s', (text) => {
  expect(() => parseLine(text)).toThrow(BasicSyntaxError);
});
test.each([
  '10 PRINT "never":END:INPUT LINE A$(0)',
  '10 DIM A$(1,1):INPUT LINE A$(0)',
  '10 DIM A$(1):END:INPUT LINE A$("x")',
])('preflights all array dependencies before any output or prompt', async (source) => {
  const f = setup(['raw']);
  expect(await f.b.runAsync(source).catch((error: unknown) => error)).toBeInstanceOf(
    BasicSyntaxError,
  );
  expect(f.output).toEqual([]);
  expect(f.prompts).toEqual([]);
});
test('rejects malformed supplied targets without replacing a prior snapshot', () => {
  const b = new Basic();
  b.reset('10 PRINT "kept"');
  const original = parseProgram('10 INPUT LINE S$').lines[0];
  for (const target of [
    null,
    {type: 'NumberLiteral', value: 0},
    {type: 'Variable', name: 3},
    {type: 'Variable', name: 'N', location: original.location},
  ]) {
    const program = {
      type: 'Program',
      lines: [
        {
          ...original,
          statement: {type: 'InputLineStatement', target, location: original.statement.location},
        },
      ],
    } as unknown as Program;
    expect(() => b.reset(program)).toThrow();
    expect(() => b.run()).not.toThrow();
  }
});
test('retains physical spans, immutable targets and old ordinary INPUT nodes', () => {
  const source = '\t020 INPUT LINE A$(0)';
  const line = parseLine(source, {line: 4, offset: 50})!;
  expect(line.statement.type).toBe('InputLineStatement');
  if (line.statement.type !== 'InputLineStatement') throw new Error('Expected line input');
  expect(line.statement.target.location.start).toEqual({line: 4, column: 17, offset: 66});
  expect(Object.isFrozen(line.statement.target)).toBe(true);
  expect(parseLine('10 INPUT S$')!.statement).toMatchObject({
    type: 'InputStatement',
    prompt: null,
    target: {name: 'S$'},
  });
});
test.each(['eof', 'oversize', 'bad-type', 'failure'])(
  'preserves target state and normalizes %s',
  async (kind) => {
    const host: Partial<Host> = {
      readLine: () =>
        kind === 'eof'
          ? Promise.resolve(null)
          : kind === 'oversize'
            ? Promise.resolve('x'.repeat(65537))
            : kind === 'failure'
              ? Promise.reject(new Error('source failed'))
              : Promise.resolve(3 as unknown as string),
    };
    const f = setup([], host),
      error = await f.b.runAsync('10 S$="kept":INPUT LINE S$').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(f.b.variables[0].value).toBe('kept');
    expect(f.b.state.diagnostic?.code).toBe(
      kind === 'eof' ? 'INPUT_ENDED' : kind === 'oversize' ? 'INPUT_LIMIT' : 'INPUT_FAILED',
    );
  },
);
test('evaluates target indices once after a response and prevents late index effects on replacement', async () => {
  const requested = Promise.withResolvers<void>(),
    response = Promise.withResolvers<string | null>();
  let calls = 0;
  const f = setup([], {
    readLine: () => {
      requested.resolve();
      return response.promise;
    },
    random: () => {
      calls++;
      return 0;
    },
  });
  const old = f.b.runAsync('10 DIM A$(0):INPUT LINE A$(RND())').catch((error: unknown) => error);
  await requested.promise;
  expect(calls).toBe(0);
  f.b.cancel();
  f.b.run('10 PRINT "new"');
  response.resolve('late');
  expect(await old).toMatchObject({name: 'AbortError'});
  expect(calls).toBe(0);
  expect(f.output).toEqual(['new\n']);
  await f.b.runAsync('10 DIM A$(0):INPUT LINE A$(RND())');
  expect(calls).toBe(1);
  expect(f.b.arrays[0].values).toEqual(['late']);
});
test('supports async immediate scalars, rejects sync entry and indexed immediate requests before prompting', async () => {
  const f = setup(['raw']);
  expect(() => f.b.readLine('10 INPUT LINE S$')).toThrow('Use runAsync');
  f.b.reset();
  await f.b.readLineAsync('10 INPUT LINE S$');
  expect(f.b.variables[0].value).toBe('raw');
  f.b.reset();
  const error = await f.b.readLineAsync('10 INPUT LINE A$(0)').catch((error: unknown) => error);
  expect(error).toBeInstanceOf(BasicRuntimeError);
  expect(f.b.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
  expect(f.prompts).toEqual(['']);
});
test('charges one debugger gate and budget unit for one line request', async () => {
  const f = setup(['raw']);
  let gates = 0;
  await f.b.runAsync('10 INPUT LINE S$:PRINT S$', {
    beforeStatement() {
      gates++;
    },
  });
  expect(gates).toBe(2);
  expect(f.prompts).toEqual(['']);
  expect(f.output).toEqual(['raw\n']);
  const stopped = setup(['unused']);
  expect(
    await stopped.b
      .runAsync('10 INPUT LINE S$', {instructionLimit: 0})
      .catch((error: unknown) => error),
  ).toBeInstanceOf(BasicRuntimeError);
  expect(stopped.prompts).toEqual([]);
});
