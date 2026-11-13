import {expect, test} from 'bun:test';
import {Basic, parseProgram} from '../index.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;

test('selected MA2 CHANGE matches archived replacement, unsigned byte codes, and empty source', () => {
  const source = [
    '10 DIM A1(6)',
    '20 A$="012"',
    '30 CHANGE A$ TO A1',
    '40 PRINT A1(0);A1(1);A1(2);A1(3)',
    '50 A$="9"',
    '60 CHANGEA$TOA1',
    '70 PRINT A1(0);A1(1);A1(2);A1(3)',
    '80 A$=""',
    '90 CHANGE A$ TO A1',
    '100 PRINT A1(0);A1(1);A1(2);A1(3)',
    '110 END',
  ].join('\n');
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  const program = parseProgram(source, options);
  basic.run(program);
  expect(output).toBe(' 3  48  49  50 \n 1  57  49  50 \n 0  57  49  50 \n');
  expect(basic.arrays[0].values).toEqual([0, 57, 49, 50, 0, 0, 0]);

  output = '';
  basic.run(
    `10 DIM A(3):S$="${String.fromCharCode(0, 128, 255)}":CHANGE S$ TO A:PRINT A(0);A(1);A(2);A(3)`,
  );
  expect(output).toBe(' 3  0  128  255 \n');
});

test('selected MA2 CHANGE admits the archived implicit bound and uses fresh storage on RUN', () => {
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  const source =
    '10 CHANGE S$ TO A:PRINT A(0);A(10):S$="0123456789":CHANGE S$ TO A:PRINT A(0);A(10)';
  const program = parseProgram(source, options);
  basic.run(program);
  expect(basic.arrays[0]).toMatchObject({name: 'A', bounds: [10]});
  basic.run();
  expect(output).toBe(' 0  0 \n 10  57 \n 0  0 \n 10  57 \n');

  basic.run('10 S$="7":CHANGE S$ TO B');
  expect(basic.arrays[0]).toMatchObject({
    name: 'B',
    bounds: [10],
    values: [1, 55, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
});

test('selected MA2 CHANGE diagnoses excess length at the statement without updating cells', () => {
  const basic = new Basic({}, options);
  expect(() => basic.run('10 DIM A(2):A(0)=9:A(1)=8:A(2)=7:S$="123"\n40 CHANGE S$ TO A')).toThrow(
    'exceeds the array capacity',
  );
  expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 40});
  expect(basic.arrays[0].values).toEqual([9, 8, 7]);
  expect(() => basic.run('10 S$="0123456789A"\n20 CHANGE S$ TO A')).toThrow(
    'exceeds the array capacity',
  );
  expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 20});
});

test('selected MA2 CHANGE gates other shapes and directions before host effects', () => {
  const output: string[] = [];
  const basic = new Basic({write: (text) => output.push(text)}, options);
  expect(() => basic.run('10 PRINT "BEFORE":END\n20 DIM A(1,1)\n30 CHANGE S$ TO A')).toThrow(
    'one-dimensional numeric array',
  );
  expect(() => basic.run('10 PRINT "BEFORE":END\n20 DIM A(2)\n30 CHANGE A TO S$')).toThrow(
    'does not support ChangeStatement',
  );
  expect(output).toEqual([]);
});
