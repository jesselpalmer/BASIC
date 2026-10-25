import {expect, it} from 'bun:test';
import {Basic, BasicRuntimeError} from '../index.ts';

it('adjacent items form one instruction and one complete write before a budget failure', async () => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)});
  const result = await basic
    .runAsync('10 PRINT "first="1\n20 PRINT "second="2', {instructionLimit: 1})
    .catch((error: unknown) => error);
  expect(result).toBeInstanceOf(BasicRuntimeError);
  if (!(result instanceof BasicRuntimeError)) throw new Error('Expected budget failure');
  expect(result.diagnostic).toMatchObject({code: 'INSTRUCTION_LIMIT', label: 20});
  expect(writes).toEqual(['first=1\n']);
  basic.run();
  expect(writes).toEqual(['first=1\n', 'first=1\n', 'second=2\n']);
});

it('adjacent output preserves host failure cause, statement location and reentrancy guard', () => {
  const cause = new Error('write failed');
  const writes: string[] = [];
  const basic = new Basic({
    write: (text) => {
      writes.push(text);
      expect(() => basic.reset()).toThrow('Cannot change execution during a statement');
      throw cause;
    },
  });
  try {
    basic.run('10 PRINT "A"1"B"2');
    throw new Error('Expected write failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.cause).toBe(cause);
    expect(error.diagnostic).toMatchObject({code: 'HOST_ERROR', label: 10, column: 4});
    expect(basic.state.diagnostic).toEqual(error.diagnostic);
  }
  expect(writes).toEqual(['A1B2\n']);
  expect(basic.status).toBe('error');
});
