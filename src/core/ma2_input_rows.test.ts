import assert from 'node:assert/strict';
import {expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {parseProgram, parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import {readSelectedMa2Input} from './ma2_statement_input.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {observeMa2Value} from './ma2_value.ts';
import type {NodeOf} from './types.ts';
import reference from '../../docs/ma2-input-rows-reference.json';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;
async function rejectsMatch(operation: Promise<unknown>, expected: object): Promise<void> {
  await assert.rejects(operation, (error) => {
    expect(error).toMatchObject(expected);
    return true;
  });
}
function row(source = '10 INPUT X,Y'): NodeOf<'InputTargetsStatement'> {
  const statement = parseBasicPlusMa2Candidate(source)[0].statement;
  if (statement.type !== 'InputTargetsStatement') throw Error('Expected INPUT row');
  return statement;
}

for (const probe of reference.cases.filter((probe) => !probe.name.startsWith('stopped'))) {
  test(`numeric INPUT row matches both archives: ${probe.name}`, async () => {
    let output = '';
    let answers: string[] = [];
    let prompts: string[] = [];
    const basic = new Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          prompts.push(prompt ?? '');
          output += (prompt ?? '') + '? ';
          return Promise.resolve(answers.shift() ?? null);
        },
      },
      options,
    );
    const source = probe.source.join('\r\n');
    const program = parseProgram(source, options);
    expect(program.source).toBe(source);
    for (const candidate of [program, undefined]) {
      output = '';
      answers = [...probe.responses];
      prompts = [];
      expect((await basic.runAsync(candidate)).status).toBe('halted');
      expect(output).toBe(probe.output);
      expect(prompts).toEqual(probe.prompts);
      expect(answers).toEqual([]);
    }
  });
}

for (const probe of reference.cases.filter((probe) => probe.name.startsWith('stopped'))) {
  test(`partial numeric fields survive cancellation as in stock: ${probe.name}`, async () => {
    let reached!: () => void;
    const waiting = new Promise<void>((resolve) => (reached = resolve));
    let release!: (text: string) => void;
    let answers = [...probe.responses];
    let output = '';
    const basic = new Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          output += (prompt ?? '') + '? ';
          if (answers.length) return Promise.resolve(answers.shift()!);
          reached();
          return new Promise<string>((resolve) => (release = resolve));
        },
      },
      options,
    );
    const operation = basic.runAsync(probe.source.join('\n'));
    await waiting;
    const before = basic.variables;
    expect(before).toEqual([
      {name: 'X', value: probe.name === 'stoppedContinuation' ? 8 : 5},
      {name: 'Y', value: 92},
    ]);
    expect(Object.isFrozen(before)).toBe(true);
    expect(output).toBe(probe.output);
    expect(basic.cancel().status).toBe('halted');
    await rejectsMatch(operation, {name: 'AbortError'});
    output = '';
    basic.run('10 PRINT X;Y\n20 END');
    expect(output).toBe(' 0  0 \n');
    release('99');
    await Promise.resolve();
    expect(basic.variables).toEqual([]);
    expect(before[0].value).toBe(probe.name === 'stoppedContinuation' ? 8 : 5);
    answers = [];
  });
}

test('row EOF retains the already assigned field and locates the physical INPUT', async () => {
  const answers = ['8', null];
  const basic = new Basic({readLine: () => Promise.resolve(answers.shift() ?? null)}, options);
  await rejectsMatch(basic.runAsync('10 X=91:Y=92\r\n20 INPUT X,Y\r\n30 END'), {
    diagnostic: {code: 'INPUT_ENDED', label: 20, line: 2, column: 4},
  });
  expect(basic.variables).toEqual([
    {name: 'X', value: 8},
    {name: 'Y', value: 92},
  ]);
});

test('retry writes run under the host mutation guard and one INPUT budget unit', async () => {
  const answers = ['5,X', '3', '4'];
  const output: string[] = [];
  const basic = new Basic(
    {
      write(text) {
        output.push(text);
        if (text.startsWith('ILLEGAL'))
          expect(() => basic.reset('10 END')).toThrow('during a statement');
      },
      readLine: () => Promise.resolve(answers.shift() ?? null),
    },
    options,
  );
  await rejectsMatch(basic.runAsync('10 INPUT X,Y\n20 PRINT X;Y\n30 END', {instructionLimit: 1}), {
    diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20},
  });
  expect(output).toEqual(['ILLEGAL NUMBER at line 10 \n']);
  expect(basic.variables).toEqual([
    {name: 'X', value: 3},
    {name: 'Y', value: 4},
  ]);
  expect(answers).toEqual([]);
});

test('failed replacement retains a pending row; valid replacement rejects late fields', async () => {
  let reached!: () => void;
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  let release!: (value: string) => void;
  let reads = 0;
  let output = '';
  const basic = new Basic(
    {
      write: (text) => (output += text),
      readLine() {
        if (reads++ === 0) return Promise.resolve('7');
        reached();
        return new Promise<string>((resolve) => (release = resolve));
      },
    },
    options,
  );
  const running = basic.runAsync('10 INPUT X,Y\n20 PRINT X;Y\n30 END');
  await waiting;
  expect(() => basic.reset('10 PRINT "WRONG"\n20 END\n30 INPUT A$,B')).toThrow('numeric scalars');
  expect(basic.status).toBe('waiting');
  expect(basic.variables).toEqual([{name: 'X', value: 7}]);
  basic.run('10 PRINT "FRESH"\n20 END');
  await rejectsMatch(running, {name: 'AbortError'});
  release('99');
  await Promise.resolve();
  expect(output).toBe('FRESH\n');
  expect(basic.variables).toEqual([]);
});

test('selected row source rejects arrays, string lists and long names before effects', () => {
  let effects = 0;
  const basic = new Basic(
    {write: () => effects++, readLine: () => (effects++, Promise.resolve('1,2'))},
    options,
  );
  for (const tail of ['INPUT A(0),B', 'INPUT A$,B', 'INPUT A,B$', 'INPUT LONG,B', 'INPUT A%,B'])
    expect(() => basic.run('10 PRINT "WRONG"\n20 END\n30 ' + tail)).toThrow();
  expect(effects).toBe(0);
  expect(() => basic.run('10 INPUT X,Y')).toThrow('runAsync');
  expect(effects).toBe(0);
});

test('internal source-bound row continuation shares the normal stepping owner', async () => {
  const session = createSelectedMa2Session('10 INPUT X,Y\n20 PRINT X;Y\n30 END');
  expect(session.advance()).toMatchObject({status: 'waiting', executed: 0});
  const answers = ['3', '4'];
  expect(
    await session.resumeInput(
      {readLine: () => Promise.resolve(answers.shift() ?? null)},
      new AbortController().signal,
    ),
  ).toMatchObject({status: 'halted', executed: 3, output: ' 3  4 \n'});
});

test('low-level row decoder bounds unsupported targets, fields, controls and numeric events', async () => {
  const signal = new AbortController().signal;
  const discard = () => {};
  for (const statement of [row('10 INPUT A$,B'), row('10 INPUT A(0),B'), {...row(), targets: []}])
    expect(
      await readSelectedMa2Input(
        {readLine: () => Promise.resolve('1,2')},
        statement,
        signal,
        discard,
      ),
    ).toEqual({kind: 'unsupported', reason: 'target'});
  expect(
    await readSelectedMa2Input({readLine: () => Promise.resolve('1,2')}, row(), signal),
  ).toEqual({kind: 'unsupported', reason: 'target'});
  for (const [text, reason] of [
    ['1,\t2', 'row'],
    ['1,é', 'row'],
    ['1,' + '9'.repeat(256), 'numeric-response'],
    ['1,1E39', 'numeric-response'],
    ['1,' + '9'.repeat(40), 'numeric-event'],
    ['1,X', 'numeric-response'],
  ] as const)
    expect(
      await readSelectedMa2Input({readLine: () => Promise.resolve(text)}, row(), signal, discard),
    ).toEqual({kind: 'unsupported', reason});
  await rejectsMatch(
    readSelectedMa2Input(
      {readLine: () => Promise.resolve(' '.repeat(65537))},
      row(),
      signal,
      discard,
    ),
    {diagnostic: {code: 'INPUT_LIMIT', label: 10}},
  );
});

test('row callbacks cannot commit a later field after cancellation or an aborted retry write', async () => {
  const controller = new AbortController();
  const fields: number[] = [];
  await rejectsMatch(
    readSelectedMa2Input(
      {readLine: () => Promise.resolve('1,2')},
      row(),
      controller.signal,
      (_index, value) => {
        const observed = observeMa2Value(value);
        if (observed.kind !== 'value') throw Error('Expected numeric value');
        fields.push(observed.value);
        controller.abort();
      },
    ),
    {name: 'AbortError'},
  );
  expect(fields).toEqual([1]);
  const retry = new AbortController();
  await rejectsMatch(
    readSelectedMa2Input(
      {readLine: () => Promise.resolve('X,2'), write: () => retry.abort()},
      row(),
      retry.signal,
      () => {},
    ),
    {name: 'AbortError'},
  );
});

test('failed replacement also preserves an async selected run between batches', async () => {
  let reached!: () => void;
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  let release!: () => void;
  let paused = false;
  const basic = new Basic({}, options);
  const operation = basic.runAsync('10 X=1\n20 X=2\n30 END', {
    yieldEvery: 1,
    scheduler() {
      if (paused) return Promise.resolve();
      paused = true;
      reached();
      return new Promise<void>((resolve) => (release = resolve));
    },
  });
  await waiting;
  const before = basic.state;
  expect(basic.variables).toEqual([{name: 'X', value: 1}]);
  expect(() => basic.reset('10 INPUT A$,B')).toThrow('numeric scalars');
  expect(basic.state).toEqual(before);
  release();
  expect((await operation).status).toBe('halted');
  expect(basic.variables).toEqual([{name: 'X', value: 2}]);
});

test('numeric rows commit repeated targets left to right across continuations', async () => {
  const answers = ['1', '2,3,4'];
  const basic = new Basic({readLine: () => Promise.resolve(answers.shift() ?? null)}, options);
  expect((await basic.runAsync('10 INPUT X,X,Z\n20 END')).status).toBe('halted');
  expect(basic.variables).toEqual([
    {name: 'X', value: 2},
    {name: 'Z', value: 3},
  ]);
});
