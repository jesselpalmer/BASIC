import {expect, test} from 'bun:test';
import {createInternalSelectedBasic} from './runtime.ts';
import {BasicRuntimeError} from './diagnostic.ts';

test.each([
  ['32768', 'MA2_INTEGER_CONVERSION'],
  ['3', 'MA2_SUBSCRIPT_BOUNDS'],
] as const)(
  'selected Basic reports the %s subscript event before committing an array write',
  async (index, code) => {
    const source = `10 DIM A(2)\n20 A(1)=5\n30 PRINT "BEFORE"\n40 A(${index})=7\n50 PRINT "AFTER"\n60 END`;
    const writes: string[] = [];
    const basic = createInternalSelectedBasic(source, {write: (text) => writes.push(text)});
    let failure: unknown;
    try {
      await basic.runAsync();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(BasicRuntimeError);
    if (!(failure instanceof BasicRuntimeError)) throw failure;
    expect(failure.diagnostic).toMatchObject({code, label: 40, line: 4});
    expect(basic.state).toMatchObject({status: 'error', diagnostic: {code, label: 40}});
    expect(basic.arrays[0].values).toEqual([0, 5, 0]);
    expect(writes).toEqual(['BEFORE\n']);
    expect(basic.reset().status).toBe('ready');
    expect(basic.arrays[0].values).toEqual([0, 0, 0]);
    expect(basic.step().nextLocation?.label).toBe(20);
  },
);

test('selected Basic fresh run succeeds after a prior input-driven subscript failure', async () => {
  const source = '10 DIM A(2)\n20 INPUT F\n30 A(F)=7\n40 PRINT A(1)\n50 END';
  const responses = ['3', '1'];
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(source, {
    readLine: () => Promise.resolve(responses.shift() ?? null),
    write: (text) => writes.push(text),
  });
  let failure: unknown;
  try {
    await basic.runAsync();
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({diagnostic: {code: 'MA2_SUBSCRIPT_BOUNDS', label: 30}});
  expect(basic.arrays[0].values).toEqual([0, 0, 0]);
  expect(basic.status).toBe('error');
  expect((await basic.runAsync()).status).toBe('halted');
  expect(basic.arrays[0].values).toEqual([0, 7, 0]);
  expect(writes).toEqual([' 7 \n']);
  expect(responses).toEqual([]);
});
