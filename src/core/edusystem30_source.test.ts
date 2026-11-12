import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import sourceReference from '../../docs/edusystem30-literal-reference.json';
import {Basic, BasicSyntaxError, parseProgram} from '../index.ts';
import {parseEduSystem30SourceLiteral} from './edusystem30_floating.ts';

const options = {dialect: 'edusystem-30'} as const;

test('EDUSYSTEM-30 separates compact LET at a statement boundary', () => {
  const source = '10 LETT=27\\LETA1 = 6\n20 END';
  const selected = new Basic({}, options);
  const program = parseProgram(source, options);
  expect(program.source).toBe(source);
  selected.run(program);
  expect(selected.variables).toEqual([
    {name: 'T', value: 27},
    {name: 'A1', value: 6},
  ]);

  const native = new Basic();
  native.run('10 LETT=27\n20 END');
  expect(native.variables).toEqual([{name: 'LETT', value: 27}]);
});

test('EDUSYSTEM-30 source literals use the compiler conversion before comparisons', async () => {
  let output = '';
  const basic = new Basic(
    {readLine: () => Promise.resolve('1.8'), write: (text) => (output += text)},
    options,
  );
  await basic.runAsync(
    '10 INPUT A\n20 IF A>1.8 THEN 40\n30 PRINT "WRONG"\n40 PRINT 1E-3;34359738367\n50 END',
  );
  expect(output).toBe(' 1E-3  3.43597E10 \n');
});

test('EDUSYSTEM-30 rejects over-wide source literals before execution', () => {
  const rejected = sourceReference.rejected.map(({source}) => source);
  for (const raw of [...rejected, '123456789012', '1E-1024', '1E-617']) {
    assert.throws(
      () => parseProgram(`10 PRINT 1\n20 A=${raw}\n30 END`, options),
      (error) =>
        error instanceof BasicSyntaxError &&
        error.diagnostic.code === 'UNSUPPORTED_EDUSYSTEM30_FORM' &&
        error.diagnostic.label === 20,
    );
  }
  expect(() => parseEduSystem30SourceLiteral('-1')).toThrow(SyntaxError);
});

test('EDUSYSTEM-30 separates compact literal transfer targets', () => {
  const source =
    '10 GOSUB50\\GO TO70\n20 PRINT "WRONG"\n50 PRINT "SUB"\\RETURN\n70 GOTO90\n80 PRINT "WRONG"\n90 END';
  const output: string[] = [];
  const program = parseProgram(source, options);
  expect(program.source).toBe(source);
  new Basic({write: (text) => output.push(text)}, options).run(program);
  expect(output.join('')).toBe('SUB\n');
  const native = new Basic();
  native.run('10 GOTO90=2\n20 END');
  expect(native.variables).toEqual([{name: 'GOTO90', value: 2}]);
});
