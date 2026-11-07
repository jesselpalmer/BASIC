import {expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {createSelectedMa2Session, runSelectedMa2StateProgram} from './ma2_state_program.ts';

test('selected source reads initially zero numeric scalars in expressions, branches and indexes', () => {
  // BASIC-PLUS Oct 1972 §§2.5.2 and 3.6.2 give numeric scalars zero defaults.
  const result = runSelectedMa2StateProgram(
    '10 DIM A(2)\n20 A(I)=B+1\n30 IF C=0 THEN 50\n40 A(0)=9\n50 END',
  );
  expect(result.arrays[0].values).toEqual([1, 0, 0]);
  expect(result.variables).toEqual([]);
  expect(result.status).toBe('halted');
  const printed = createSelectedMa2Session('10 PRINT B\n20 END').advance();
  expect(printed.output).toBe(' 0 \n');
});

test('selected zero defaults do not leak across assignments or fresh sessions', () => {
  const source = '10 A=B+1\n20 B=3\n30 A=A+B\n40 END';
  const first = runSelectedMa2StateProgram(source);
  const second = runSelectedMa2StateProgram(source);
  expect(first.variables).toEqual([
    {name: 'A', value: 4},
    {name: 'B', value: 3},
  ]);
  expect(second.variables).toEqual(first.variables);
  expect(runSelectedMa2StateProgram('10 END\n20 A=B+1').variables).toEqual([]);
});

test('native and MA2 conformance retain their existing unbound scalar policies', () => {
  expect(() => new Basic().run('10 PRINT B')).toThrow('Undefined variable B');
  const conformance = createBasicPlusMa2ArraySession();
  expect(() => conformance.evaluate('B')).toThrow('Unbound MA2 conformance scalar B');
  expect(() =>
    createBasicPlusMa2ArraySession([], {defaultNumericScalars: 'zero' as unknown as boolean}),
  ).toThrow('Expected a numeric scalar default policy');
});
