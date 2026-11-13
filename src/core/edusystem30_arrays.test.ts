import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import golfReference from '../../docs/golf-edusystem30-reference.json';
import indexedInputReference from '../../docs/edusystem30-indexed-input-reference.json';
import {Basic, parseProgram} from '../index.ts';
import {ArrayStore} from './arrays.ts';
import {eduSystem30FromNumber} from './edusystem30_floating.ts';

const options = {dialect: 'edusystem-30'} as const;
const source = [
  '10 DIM M(3),Y(2)',
  '20 M=2',
  '30 Y=3',
  '40 PRINT M;Y;M(0);M(3);Y(0);Y(2)',
  '50 M(3)=8',
  '60 Y(0)=7',
  '70 PRINT M;Y;M(3);Y(0)',
  '80 END',
].join('\n');

test('EDUSYSTEM-30 DIM keeps same-named scalars separate and clears arrays for fresh RUN', () => {
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  basic.reset(parseProgram(source, options));
  for (let i = 0; i < 2; i++) {
    output = '';
    basic.run();
    expect(output).toBe(' 2  3  0  0  0  0 \n 2  3  8  7 \n');
    expect(basic.variables).toEqual([
      {name: 'M', value: 2},
      {name: 'Y', value: 3},
    ]);
    expect(basic.arrays.map(({name, bounds, values}) => ({name, bounds, values}))).toEqual([
      {name: 'M', bounds: [3], values: [0, 0, 0, 8]},
      {name: 'Y', bounds: [2], values: [7, 0, 0]},
    ]);
  }
});

test('EDUSYSTEM-30 truncates nonnegative subscripts for both reads and writes', () => {
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  basic.run(
    '10 DIM A(3)\n20 A(.5)=10\n30 A(1+.5)=20\n40 A(3+.5)=40\n50 PRINT A(0);A(1);A(3+.5)\n60 END',
  );
  expect(output).toBe(' 10  20  40 \n');
  for (const index of ['-.5', '4']) {
    expect(() => basic.run(`10 DIM A(3)\n20 PRINT A(${index})\n30 END`)).toThrow();
    expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 20});
  }
});

test.each(['edusystem-30', 'edusystem-30-mark'] as const)(
  '%s defaults rank-one bounds to 0 through 10 and clears values on RUN',
  (dialect) => {
    const program = parseProgram(
      '10 PRINT A(0);A(10);A\n20 A(0)=7\n30 A(10)=9\n40 A=42\n50 PRINT A(0);A(10);A\n60 END',
      {dialect},
    );
    let output = '';
    const basic = new Basic({write: (text) => (output += text)}, {dialect});
    basic.reset(program);
    for (let i = 0; i < 2; i++) {
      output = '';
      basic.run();
      expect(output).toBe(' 0  0  0 \n 7  9  42 \n');
      expect(basic.arrays[0]).toMatchObject({name: 'A', bounds: [10], elementCount: 11});
    }
    expect(() => basic.run('10 PRINT A(10.5)\n20 PRINT A(11)\n30 END')).toThrow('0 through 10');
    expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 20});
  },
);

test('EDUSYSTEM-30 uses later DIM bounds from the first access', () => {
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  basic.run('10 A(12)=9\n20 DIM A(12)\n30 PRINT A(12)\n40 END');
  expect(output).toBe(' 9 \n');
  expect(() => basic.run('10 PRINT A(5)\n20 DIM A(3)\n30 END')).toThrow('0 through 3');
  expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 10});
});

test('EDUSYSTEM-30 stores exact array values below the host observation range', async () => {
  let output = '';
  const basic = new Basic(
    {write: (text) => (output += text), readLine: () => Promise.resolve('1E-400')},
    options,
  );
  await basic.runAsync(
    '10 DIM A(1)\n20 INPUT X\n30 A(0)=X\n35 INPUT A(1)\n40 IF A(1)>0 THEN 60\n50 PRINT "LOST"\n60 IF A(1)=A(0) THEN 80\n70 PRINT "MISMATCH"\n80 END',
  );
  expect(output).toBe('');
  expect(basic.arrays[0].values).toEqual([0, 0]);
});

for (const {name, source, answers, output: archived, diagnostic} of indexedInputReference.probes) {
  test(`EDUSYSTEM-30 indexed INPUT reproduces archived ${name}`, async () => {
    let output = '';
    let answer = 0;
    const basic = new Basic(
      {
        write: (text) => (output += text),
        readLine(prompt) {
          output += prompt ?? '';
          return Promise.resolve(answers[answer++] ?? null);
        },
      },
      options,
    );
    const run = basic.runAsync(source.join('\n'));
    if (diagnostic) {
      await assert.rejects(run, /0 through 2/);
      expect(basic.state.diagnostic).toMatchObject(diagnostic);
    } else {
      await run;
    }
    expect(answer).toBe(answers.length);
    expect(output).toBe(archived.replace(/\nERROR SS AT LINE \d+\n$/, ''));
  });
}

test('EDUSYSTEM-30 indexed INPUT keeps the first target intact when cancelled mid-read', async () => {
  const requested = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<string>();
  let reads = 0;
  const basic = new Basic(
    {
      readLine() {
        if (reads++ === 0) return Promise.resolve('9');
        requested.resolve();
        return pending.promise;
      },
    },
    options,
  );
  const run = basic.runAsync('10 DIM A(2)\n20 A(1)=5\n30 INPUT A(1),A(2)\n40 END');
  await requested.promise;
  expect(basic.arrays[0].values).toEqual([0, 5, 0]);
  basic.cancel();
  pending.resolve('7');
  await assert.rejects(run, {name: 'AbortError'});
  expect(basic.arrays[0].values).toEqual([0, 5, 0]);
});

test('EDUSYSTEM-30 reproduces the archived GOLF rank-two array probe', () => {
  const probe = golfReference.probes.find(({name}) => name === 'two-dimensional arrays')!;
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  basic.run(probe.source);
  expect(output).toBe(probe.output);
  expect(basic.arrays[0]).toMatchObject({name: 'M', bounds: [4, 18], elementCount: 95});
});

test('EDUSYSTEM-30 truncates both axes and diagnoses the offending subscript', () => {
  const probe = golfReference.probes.find(({name}) => name === 'two-dimensional index bounds')!;
  let output = '';
  const basic = new Basic({write: (text) => (output += text)}, options);
  expect(() => basic.run(probe.source)).toThrow('Negative array subscript');
  expect(output).toBe(probe.output.split('\n\nERROR SS')[0] + '\n');
  expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 30, column: 14});
  expect(() => basic.run('10 DIM M(4,18)\n20 M(5,0)=3\n30 END')).toThrow('0 through 4');
  expect(basic.state.diagnostic).toMatchObject({code: 'ARRAY_BOUNDS', label: 20, column: 6});
});

test('EDUSYSTEM-30 preflights array declarations and references even after END', () => {
  for (const line of ['DIM A(0)', 'DIM A(1,0)', 'DIM A$(1)', 'PRINT A$(1)', 'PRINT A(1,A$)']) {
    expect(() => parseProgram(`10 END\n20 ${line}\n30 END`, options)).toThrow('EDUSYSTEM-30');
  }
  expect(() => parseProgram('10 PRINT A(1,2)\n20 END', options)).toThrow('requires DIM');
  expect(() => parseProgram('10 PRINT A(1)\n20 END')).toThrow('requires DIM');
  expect(() => parseProgram('10 DIM A(1,2)\n20 END\n30 PRINT A(1)\n40 END', options)).toThrow(
    'requires 2 index(es)',
  );
  expect(() => parseProgram('10 END\n20 INPUT A(1,2)\n30 END', options)).toThrow('requires DIM');
  expect(() => parseProgram('10 DIM A(1,2)\n20 END\n30 INPUT A(1)\n40 END', options)).toThrow(
    'requires 2 index(es)',
  );
  for (const line of ['INPUT A(1,A$)', 'INPUT A$(1)', 'INPUT "A";A(1)', 'INPUT A(1),B,C,D'])
    expect(() => parseProgram(`10 ${line}\n20 END`, options)).toThrow('EDUSYSTEM-30');
});

test('ArrayStore guards native and EDUSYSTEM-30 access against the wrong storage context', () => {
  const statement = parseProgram('10 DIM A(1)\n20 PRINT A(1)').lines[1].statement;
  if (statement.type !== 'PrintStatement' || statement.items[0].type !== 'ArrayReference')
    throw new Error('Expected an array PRINT');
  const reference = statement.items[0];
  expect(() => new ArrayStore().readEduSystem30(reference, [eduSystem30FromNumber(1)])).toThrow(
    'selected array context',
  );
  expect(() => new ArrayStore([], 'edusystem-30').read(reference, [1])).toThrow(
    'Native access is unavailable',
  );
});
