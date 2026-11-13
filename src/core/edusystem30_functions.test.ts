import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import reference from '../../docs/3dplot-edusystem30-reference.json';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';

const options = {dialect: 'edusystem-30'} as const;

test.each(reference.functionProbes.filter(({output}) => !output.includes('ERROR SP')))(
  'EDUSYSTEM-30 DEF matches the archived $name probe',
  ({source, output}) => {
    const written: string[] = [];
    const basic = new Basic({write: (text) => written.push(text)}, options);
    basic.run(parseProgram(source, options));
    expect(written.join('')).toBe(output);
    written.length = 0;
    basic.run();
    expect(written.join('')).toBe(output);
  },
);

test('EDUSYSTEM-30 recursive DEF halts at the calling line without leaking bindings', () => {
  const source = '10 DEF FNA(Z)=FNA(Z)+1\n15 Z=8\n20 PRINT FNA(1)\n30 END';
  const written: string[] = [];
  const basic = new Basic({write: (text) => written.push(text)}, options);
  try {
    basic.run(source);
    throw new Error('Expected a function stack diagnostic');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect((error as BasicRuntimeError).diagnostic).toMatchObject({
      code: 'FUNCTION_RECURSION',
      label: 20,
    });
  }
  expect(basic.variables).toEqual([{name: 'Z', value: 8}]);
  expect(written).toEqual([]);
});

test('EDUSYSTEM-30 rejects unresolved calls and unsupported definitions before running', () => {
  for (const line of [
    'PRINT FNA(1)',
    'DEF FNAB(Z)=Z',
    'DEF FNA(Z,Y)=Z+Y',
    'DEF FNA(A$)=1',
    'DEF FNA(A)="TEXT"',
  ])
    expect(() => parseProgram(`10 ${line}\n20 END`, options)).toThrow(BasicSyntaxError);
});

test('Native DEF and FNA retain their variable and array meanings', () => {
  const written: string[] = [];
  new Basic({write: (text) => written.push(text)}).run(
    '10 DEF=7\n20 DIM FNA(2)\n30 FNA(1)=DEF\n40 PRINT FNA(1)\n50 END',
  );
  expect(written.join('')).toBe('7\n');
  expect(() => parseProgram('10 DEF FNA(Z)=Z\n20 END')).toThrow(BasicSyntaxError);
});

test('EDUSYSTEM-30 bounds acyclic function expansion in one expression', () => {
  const names = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const definitions = names
    .slice(0, -1)
    .map(
      (name, index) =>
        `${10 + index} DEF FN${name}(Z)=FN${names[index + 1]}(Z)+FN${names[index + 1]}(Z)`,
    );
  const source = [...definitions, '40 DEF FNZ(Z)=Z', '50 PRINT FNA(1)', '60 END'].join('\n');
  const written: string[] = [];
  const basic = new Basic({write: (text) => written.push(text)}, options);
  assert.throws(
    () => basic.run(source),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'FUNCTION_LIMIT' &&
      error.diagnostic.label === 50,
  );
  expect(written).toEqual([]);
});
