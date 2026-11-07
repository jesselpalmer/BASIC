import {expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {BasicRuntimeError, BasicSyntaxError} from './diagnostic.ts';
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

test('selected two-dimensional implicit arrays have bound ten in both dimensions', () => {
  // BASIC-PLUS October 1972 §7.1 equates implicit A(I,J) with DIM A(10,10).
  const source = '10 B=A(0,10)\n20 A(0,10)=B+9\n25 A(10,10)=B+7\n30 C=A(10,10)\n40 END';
  const first = runSelectedMa2StateProgram(source);
  const second = runSelectedMa2StateProgram(source);
  expect(first.arrays).toHaveLength(1);
  expect(first.arrays[0]).toMatchObject({
    name: 'A',
    bounds: [10, 10],
    elementCount: 121,
    truncated: true,
  });
  expect(first.arrays[0].values).toHaveLength(64);
  expect(first.arrays[0].values.filter((value) => value !== 0)).toEqual([9]);
  expect(first.variables).toEqual([
    {name: 'B', value: 0},
    {name: 'C', value: 7},
  ]);
  expect(second.arrays).toEqual(first.arrays);
  for (const index of ['11,0', '0,11']) {
    try {
      runSelectedMa2StateProgram(`10 A(${index})=1\n20 END`);
      throw new Error('Expected out-of-bounds failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BasicRuntimeError);
      if (!(error instanceof BasicRuntimeError)) throw error;
      expect(error.diagnostic.code).toBe('MA2_SUBSCRIPT_BOUNDS');
      expect(error.diagnostic.label).toBe(10);
    }
  }
});

test('explicit DIM uses its declared bound rather than the implicit bound', () => {
  const result = runSelectedMa2StateProgram('10 DIM A(12)\n20 A(12)=5\n30 B=A(12)\n40 END');
  expect(result.arrays[0].bounds).toEqual([12]);
  expect(result.arrays[0].values[12]).toBe(5);
  expect(result.variables).toContainEqual({name: 'B', value: 5});
  const matrix = runSelectedMa2StateProgram('10 DIM A(12,2)\n20 A(12,2)=9\n30 END');
  expect(matrix.arrays[0].bounds).toEqual([12, 2]);
  expect(matrix.arrays[0].values.filter((value) => value !== 0)).toEqual([9]);
});

test('later explicit DIM controls an earlier selected array access', () => {
  // BASIC-PLUS October 1972 §3.6.2 permits DIM after the first reference,
  // including later on the same multiple-statement line.
  for (const source of [
    '10 A(12)=5:DIM A(12)\n20 B=A(12)\n30 END',
    '10 A(12)=5\n20 GOTO 40\n30 DIM A(12)\n40 B=A(12)\n50 END',
  ]) {
    const first = runSelectedMa2StateProgram(source);
    const second = runSelectedMa2StateProgram(source);
    expect(first.variables).toContainEqual({name: 'B', value: 5});
    expect(first.arrays[0]).toMatchObject({name: 'A', bounds: [12], elementCount: 13});
    expect(first.arrays[0].values[12]).toBe(5);
    expect(second.arrays).toEqual(first.arrays);
  }
});

test('duplicate selected DIM is rejected at preparation before any execution', () => {
  // The current safe declaration policy rejects duplicate names. This test
  // does not claim a historical error number or continuation rule.
  const source = '10 A(12)=5\n20 DIM A(12)\n30 DIM A(12)\n40 END';
  try {
    createSelectedMa2Session(source);
    throw new Error('Expected duplicate declaration failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic).toMatchObject({code: 'DUPLICATE_DIM', label: 30});
  }
});

test('mixed implicit ranks reject before selected output; native and conformance stay explicit', () => {
  expect(() =>
    createSelectedMa2Session('10 PRINT "READY"\n20 A(1,2)=3\n30 A(1)=4\n40 END'),
  ).toThrow('index(es)');
  expect(() => createSelectedMa2Session('10 PRINT "READY"\n20 PRINT A$(1)\n30 END')).toThrow(
    'implicit arrays require numeric names',
  );
  expect(() => new Basic().run('10 A(0)=1\n20 END')).toThrow('requires DIM');
  expect(() => createBasicPlusMa2ArraySession().evaluate('A(0)')).toThrow('requires DIM');
});
