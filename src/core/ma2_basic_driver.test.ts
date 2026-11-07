import {expect, test} from 'bun:test';
import Basic, {createInternalSelectedBasic} from './runtime.ts';
import {parseProgram} from '../parser/parser.ts';

const source = '10 FOR I=1 TO 2\n20 PRINT I;\n30 NEXT I\n40 END';

test('internal source-bound MA2 runs under Basic step and fresh-run ownership', async () => {
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(source, {write: (text) => writes.push(text)});
  expect(() => basic.dialect).toThrow('no public dialect');
  expect(basic.state).toMatchObject({status: 'ready', nextLocation: {label: 10}});
  expect(basic.variables).toEqual([]);
  expect(basic.step().nextLocation?.label).toBe(20);
  expect(basic.step().nextLocation?.label).toBe(30);
  expect(writes).toEqual([' 1 ']);
  while (basic.status !== 'halted') basic.step();
  expect(writes).toEqual([' 1 ', ' 2 ']);
  expect(basic.variables).toContainEqual({name: 'I', value: 2});
  expect((await basic.runAsync()).status).toBe('halted');
  expect(writes).toEqual([' 1 ', ' 2 ', ' 1 ', ' 2 ']);
  expect(basic.run().status).toBe('halted');
  expect(basic.variables).toContainEqual({name: 'I', value: 2});
});

test('internal Basic rejects unsupported/dead source before effects and preserves prior snapshot', () => {
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(source, {write: (text) => writes.push(text)});
  expect(() => basic.reset('10 PRINT "EARLY"\n20 INPUT Z\n30 END')).toThrow(
    'Selected MA2 input requires F, T or A$',
  );
  expect(writes).toEqual([]);
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual([' 1 ', ' 2 ']);
  expect(() => basic.reset('10 END\n20 PRINT "LATE"\n30 INPUT Z')).toThrow();
  expect(() => basic.reset(parseProgram('10 END'))).toThrow('requires exact source');
  expect(() => basic.readLine('PRINT 1')).toThrow('requires a complete source program');
  expect(() => new Basic({}, {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow();
  expect(() => new Basic({}, {}, {token: Symbol('foreign'), source})).toThrow(
    'Unsupported internal execution context',
  );
});

test('internal Basic bounds synchronous selected loops at a real source line', () => {
  const basic = createInternalSelectedBasic('10 GOTO 10');
  let failure: unknown;
  try {
    basic.run();
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT', label: 10}});
  expect(basic.status).toBe('error');
});

test('internal Basic exposes run-owned MA2 array snapshots without changing native state', () => {
  const basic = createInternalSelectedBasic('10 DIM A(2)\n20 A(1)=3\n30 END');
  expect(basic.run().status).toBe('halted');
  expect(basic.arrays[0].values[1]).toBe(3);
  expect(basic.reset().status).toBe('ready');
  expect(basic.arrays[0].values[1]).toBe(0);
  const native = new Basic();
  expect(native.run('10 A=4\n20 END').status).toBe('halted');
  expect(native.variables).toContainEqual({name: 'A', value: 4});
  expect(native.arrays).toEqual([]);
});
