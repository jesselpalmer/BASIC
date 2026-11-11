import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';

import reference from '../../docs/edusystem30-step-reference.json';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';

const options = {dialect: 'edusystem-30'} as const;

test.each(reference.probes)('EDUSYSTEM-30 matches archived $name', ({source, output}) => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  basic.run(source);
  expect(writes.join('')).toBe(output);
});

test('EDUSYSTEM-30 reports zero STEP before running the body', () => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  assert.throws(
    () => basic.run(reference.zeroStepProbe.source),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'ZERO_STEP' &&
      error.diagnostic.label === 10,
  );
  expect(writes).toEqual([]);
});

test('EDUSYSTEM-30 preflights the STEP expression even after END', () => {
  expect(() =>
    parseProgram('10 END\n20 FOR I=1 TO 3 STEP 2^2\n30 NEXT I\n40 END', options),
  ).toThrow(BasicSyntaxError);
});
