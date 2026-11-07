import {expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {createSelectedMa2Session, runSelectedMa2StateProgram} from './ma2_state_program.ts';

test('selected one-dimensional numeric arrays default to upper bound ten with fresh zero cells', () => {
  // BASIC-PLUS October 1972 §§2.5.2 and 5.1.2 document implicit bound 10.
  const source = '10 B=A(10)\n20 A(10)=B+7\n30 C=A(10)\n40 END';
  const first = runSelectedMa2StateProgram(source);
  const second = runSelectedMa2StateProgram(source);
  expect(first.arrays).toContainEqual({
    name: 'A',
    bounds: [10],
    elementCount: 11,
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7],
    truncated: false,
  });
  expect(first.variables).toEqual([
    {name: 'B', value: 0},
    {name: 'C', value: 7},
  ]);
  expect(second.arrays).toEqual(first.arrays);
  try {
    runSelectedMa2StateProgram('10 A(11)=1\n20 END');
    throw new Error('Expected out-of-bounds failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe('MA2_SUBSCRIPT_BOUNDS');
    expect(error.diagnostic.label).toBe(10);
  }
});

test('explicit DIM uses its declared bound rather than the implicit bound', () => {
  const result = runSelectedMa2StateProgram('10 DIM A(12)\n20 A(12)=5\n30 B=A(12)\n40 END');
  expect(result.arrays[0].bounds).toEqual([12]);
  expect(result.arrays[0].values[12]).toBe(5);
  expect(result.variables).toContainEqual({name: 'B', value: 5});
});

test('unsupported implicit rank rejects before selected output; native and conformance stay explicit', () => {
  expect(() => createSelectedMa2Session('10 PRINT "READY"\n20 END\n30 A(1,2)=3')).toThrow(
    'implicit arrays require one numeric dimension',
  );
  expect(() => new Basic().run('10 A(0)=1\n20 END')).toThrow('requires DIM');
  expect(() => createBasicPlusMa2ArraySession().evaluate('A(0)')).toThrow('requires DIM');
});
