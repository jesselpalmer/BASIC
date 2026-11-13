import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import Basic from './runtime.ts';
import {BasicRuntimeError} from './diagnostic.ts';

const options = {dialect: 'edusystem-30'} as const;

test('CHAIN starts a new program with fresh variables, loops, and RNG and retains the RUN entry', () => {
  const first = [
    '10 DIM A(20)',
    '20 A=42',
    '30 A(17)=67',
    '40 PRINT "CALLER";A;A(17);RND(0)',
    '50 CHAIN "PROBE1"',
    '60 PRINT "UNREACHABLE"',
    '70 END',
  ].join('\n');
  const target = '10 DIM A(20)\n20 PRINT "CALLEE";A;A(17);RND(0)\n30 END';
  const loaded: string[] = [];
  let output = '';
  const basic = new Basic(
    {
      loadProgram(name) {
        loaded.push(name);
        return target;
      },
      write: (text) => (output += text),
    },
    options,
  );
  basic.reset(first);
  for (let i = 0; i < 5; i++) basic.step();
  expect(basic.activeSource).toBe(target);
  expect(basic.state.nextLocation?.label).toBe(10);
  basic.step();
  basic.step();
  basic.step();
  const expected = 'CALLER 42  67  .22299 \nCALLEE 0  0  .22299 \n';
  expect(output).toBe(expected);
  expect(basic.state.status).toBe('halted');
  expect(basic.run().status).toBe('halted');
  expect(output).toBe(expected.repeat(2));
  expect(loaded).toEqual(['PROBE1', 'PROBE1']);
});

test('CHAIN rewinds inherited DATA, replaces it with target DATA, and resets terminal column', () => {
  const target = '10 READ A,B\n20 PRINT TAB(2);A;B\n30 END';
  let output = '';
  const basic = new Basic(
    {
      loadProgram: (name) => (name === 'FIRST ' ? target : '5 DATA 71,72\n' + target),
      write: (text) => (output += text),
    },
    options,
  );
  const prefix = '10 DATA 41,42\n20 READ A\n30 PRINT "ABC";\n';
  basic.run(prefix + '40 CHAIN "FIRST"\n50 END');
  basic.run(prefix + '40 CHAIN "SECOND"\n50 END');
  expect(output).toBe('ABC   41  42 \nABC   71  72 \n');
});

test('successive CHAINs rewind the active DATA pool, including a replacement pool', () => {
  const programs = new Map([
    ['PROBE2', '10 READ U,V\n20 PRINT "DATA";U;V\n30 END'],
    ['PROBE7', '10 READ A\n20 PRINT "FIRST";A\n30 CHAIN "PROBE2"\n40 END'],
    ['PROBE8', '10 DATA 71,72\n20 READ A\n30 PRINT "OWN";A\n40 CHAIN "PROBE2"\n50 END'],
  ]);
  let output = '';
  const basic = new Basic(
    {
      loadProgram: (name) => programs.get(name) ?? null,
      write: (text) => (output += text),
    },
    options,
  );
  basic.run('10 DATA 41,42\n20 READ B\n30 CHAIN "PROBE7"\n40 END');
  basic.run('10 DATA 41,42\n20 CHAIN "PROBE8"\n30 END');
  expect(output).toBe('FIRST 41 \nDATA 41  42 \nOWN 71 \nDATA 71  72 \n');
});

test('CHAIN clears unread input fields and shares the async execution budget', async () => {
  const replies = ['1,7', '9'];
  const target = '10 INPUT A\n20 PRINT A\n30 END';
  let output = '';
  const basic = new Basic(
    {
      loadProgram: () => target,
      readLine: () => Promise.resolve(replies.shift() ?? null),
      write: (text) => (output += text),
    },
    options,
  );
  const first = '10 INPUT A\n20 CHAIN "SECOND"\n30 END';
  await basic.runAsync(first, {instructionLimit: 10});
  expect(output).toBe(' 9 \n');
  const cycle = '10 CHAIN "SECOND"\n20 END';
  const cycling = new Basic({loadProgram: () => cycle}, options);
  await assert.rejects(
    cycling.runAsync(cycle, {instructionLimit: 3}),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'INSTRUCTION_LIMIT' &&
      error.diagnostic.label === 10,
  );
});

test('CHAIN failures point to the caller without installing the target', () => {
  const first = '10 A=42\n20 CHAIN "SECOND"\n30 END';
  const assertFailure = (basic: Basic, code: string) => {
    try {
      basic.run(first);
      throw new Error('Expected CHAIN to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BasicRuntimeError);
      expect(error).toMatchObject({diagnostic: {code, label: 20}});
      expect(basic.activeSource).toBe(first);
      expect(basic.variables).toEqual([{name: 'A', value: 42}]);
    }
  };
  assertFailure(new Basic({}, options), 'CHAIN_UNAVAILABLE');
  assertFailure(new Basic({loadProgram: () => null}, options), 'CHAIN_NOT_FOUND');
  assertFailure(
    new Basic({loadProgram: () => '10 PRINT "NEVER"'}, options),
    'CHAIN_INVALID_PROGRAM',
  );
  assertFailure(new Basic({loadProgram: () => ''}, options), 'CHAIN_INVALID_PROGRAM');
  const reentrant: Basic = new Basic({loadProgram: () => (reentrant.reset(), null)}, options);
  assertFailure(reentrant, 'HOST_ERROR');
});
