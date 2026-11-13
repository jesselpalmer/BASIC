import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import {parseProgram, validateProgram} from '../parser/parser.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import Basic from './runtime.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;

test('selected SLEEP evaluates seconds and resumes after one cancellable host wait', async () => {
  const source = '10 A=2\n20 SLEEP(A+3)\n30 PRINT "READY"\n40 END';
  let output = '';
  let release = () => {};
  const requests: number[] = [];
  const basic = new Basic(
    {
      write: (text) => (output += text),
      wait(milliseconds) {
        requests.push(milliseconds);
        return new Promise<void>((resolve) => (release = resolve));
      },
    },
    options,
  );
  basic.reset(parseProgram(source, options));
  basic.step();
  const delayed = basic.stepAsync();
  expect(basic.state.status).toBe('waiting');
  expect(basic.state.currentLocation?.label).toBe(20);
  expect(requests).toEqual([5000]);
  expect(output).toBe('');
  release();
  expect((await delayed).nextLocation?.label).toBe(30);
  basic.step();
  expect(output).toBe('READY\n');

  basic.reset();
  basic.step();
  const cancelled = basic.stepAsync();
  basic.cancel();
  await assert.rejects(cancelled, {name: 'AbortError'});
  release();
  expect(basic.state.status).toBe('halted');
  expect(output).toBe('READY\n');
});

test('selected SLEEP checks the complete source and reports unsupported durations', async () => {
  const writes: string[] = [];
  const sleeps: number[] = [];
  const basic = new Basic(
    {write: (text) => writes.push(text), wait: (time) => (sleeps.push(time), Promise.resolve())},
    options,
  );
  expect(() => basic.reset('10 PRINT "EARLY"\n20 END\n30 SLEEP "FIVE"')).toThrow(
    'SLEEP duration must be numeric',
  );
  expect(writes).toEqual([]);
  for (const seconds of ['-1', '.5', '32768']) {
    await assert.rejects(
      basic.runAsync(`10 SLEEP(${seconds})\n20 END`),
      (error) =>
        error instanceof BasicRuntimeError &&
        error.diagnostic.code === 'INVALID_SLEEP_DURATION' &&
        error.diagnostic.label === 10,
    );
  }
  expect(sleeps).toEqual([]);
  expect((await basic.runAsync('10 SLEEP 0\n20 END')).status).toBe('halted');
  expect(sleeps).toEqual([0]);
  expect(() => basic.run('10 SLEEP(5)\n20 END')).toThrow('Use runAsync or stepAsync for SLEEP');
  expect(() => createSelectedMa2Session('10 SLEEP(5)\n20 END')).toThrow(
    'Selected MA2 state execution does not support SleepStatement',
  );
  expect(() => parseProgram('10 SLEEP(5)\n20 END')).toThrow();
  expect(() => parseProgram('10 SLEEP(5)\n20 END', {dialect: 'altair-8k-4.0'})).toThrow();
  const selected = parseProgram('10 SLEEP(A)\n20 END', options);
  const forged = selected.lines.map((line) => ({...line, dialect: 'native' as const}));
  expect(() => validateProgram(forged)).toThrow('SLEEP requires the selected BASIC-PLUS profile');
  expect(parseProgram('10 SLEEP=5\n20 PRINT SLEEP').lines).toHaveLength(2);
});

test('selected numeric and string INPUT resume PRINT at column zero without emitting echo', async () => {
  const replies = ['7', 'YES'];
  const source = [
    '10 PRINT "PREFIX";',
    '20 INPUT A',
    '30 PRINT TAB(4);"TAIL"',
    '40 PRINT "PREFIX";',
    '50 INPUT A$',
    '60 PRINT TAB(4);"TAIL"',
    '70 END',
  ].join('\n');
  let output = '';
  const basic = new Basic(
    {
      write: (text) => (output += text),
      readLine: () => Promise.resolve(replies.shift() ?? null),
    },
    options,
  );
  expect((await basic.runAsync(source)).status).toBe('halted');
  expect(output).toBe('PREFIX    TAIL\nPREFIX    TAIL\n');
});
