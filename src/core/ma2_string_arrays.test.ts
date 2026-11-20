import {expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {parseProgram} from '../parser/parser.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;

function run(source: string) {
  const chunks: string[] = [];
  const basic = new Basic({write: (text) => chunks.push(text)}, options);
  expect(basic.run(source).status).toBe('halted');
  return {basic, output: chunks.join('')};
}

test('selected string arrays match archived defaults, scalar independence and DIM bounds', () => {
  const {basic, output} = run(
    [
      '10 DIM A$(2)',
      '20 PRINT "[";A$(0);A$(2);"]"',
      '30 A$="SCALAR"',
      '40 A$(1)="LONGER THAN DIM"',
      '50 PRINT A$;":";A$(1)',
      '60 END',
    ].join('\n'),
  );
  expect(output).toBe('[]\nSCALAR:LONGER THAN DIM\n');
  expect(basic.variables).toEqual([{name: 'A$', value: 'SCALAR'}]);
  expect(basic.arrays).toEqual([
    {
      name: 'A$',
      bounds: [2],
      elementCount: 3,
      values: ['', 'LONGER THAN DIM', ''],
      truncated: false,
    },
  ]);
});

test('selected string elements use MA2 index truncation for both ranks and later DIM', () => {
  const {basic, output} = run(
    [
      '10 A$(.9,1.9)="ONE"',
      '20 DIM A$(1,2)',
      '30 A$(-.9,2.9)="TWO"',
      '40 PRINT A$(0,1);":";A$(0,2)',
      '50 PRINT A$(1,0)',
      '60 END',
    ].join('\n'),
  );
  expect(output).toBe('ONE:TWO\n\n');
  expect(basic.arrays[0].values).toEqual(['', 'ONE', 'TWO', '', '', '']);
  expect(basic.variables).toEqual([]);
  const implicit = run('10 A$(10,10)="TEN"\n20 PRINT A$(10,10)\n30 END');
  expect(implicit.output).toBe('TEN\n');
  expect(implicit.basic.arrays[0]).toMatchObject({
    bounds: [10, 10],
    elementCount: 121,
    truncated: true,
  });
});

test('string array reads, writes, blank padded comparisons and snapshots survive fresh runs', () => {
  const source =
    '10 PRINT A$(1)\n20 A$(1)="X"\n30 B$(2)=A$(1)\n40 IF B$(2)="X " THEN 60\n50 A$(1)="BAD"\n60 END';
  const {basic, output} = run(source);
  expect(output).toBe('\n');
  const prior = basic.arrays;
  expect(prior.find(({name}) => name === 'A$')!.values[1]).toBe('X');
  expect(prior.find(({name}) => name === 'B$')!.values[2]).toBe('X');
  expect(Object.isFrozen(prior)).toBe(true);
  expect(Object.isFrozen(prior[0].values)).toBe(true);
  expect(basic.run().status).toBe('halted');
  expect(basic.arrays).toEqual(prior);
  basic.run('10 DIM A$(1)\n20 END');
  expect(basic.arrays[0].values).toEqual(['', '']);
  expect(prior.find(({name}) => name === 'A$')!.values[1]).toBe('X');
});

test('string assignment evaluates RHS before target indices and never commits a failed element', () => {
  const session = createSelectedMa2Session('10 A$(0)="OLD"\n20 A$(1/0)=A$(11)\n30 END');
  // RHS subscript failure takes precedence over the target division by zero.
  expect(() => session.advance()).toThrow('Index must be an integer');
  expect(session.driver.arrays()[0].values[0]).toBe('OLD');
  const chunks: string[] = [];
  const basic = new Basic({write: (text) => chunks.push(text)}, options);
  expect(() => basic.run('10 A$(0)="OLD"\n20 A$(1/0)="NEW"\n30 END')).toThrow('numeric-event: 61');
  expect(basic.arrays[0].values[0]).toBe('OLD');
  expect(chunks).toEqual([]);
});

test('preflight rejects dead invalid ranks, indices and unsupported string forms before output', () => {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  for (const source of [
    '10 PRINT "READY"\n20 END\n30 DIM A$(1)\n40 A$(0,0)="X"',
    '10 PRINT "READY"\n20 END\n30 A$("X")="X"',
    '10 PRINT "READY"\n20 END\n30 A$(0)="X"+"Y"',
    '10 PRINT "READY"\n20 END\n30 A$(0)=1',
  ])
    expect(() => basic.run(source)).toThrow();
  expect(writes).toEqual([]);
  const parsed = parseProgram('10 A$(0)="X"\n20 END', options);
  const changed = {...parsed, lines: [{...parsed.lines[0], label: 11}, parsed.lines[1]]};
  expect(() => basic.run(changed)).toThrow('disagrees');
});

test('string and numeric arrays share observation limits while numeric conformance remains explicit', () => {
  const {basic} = run('10 DIM A(99),B$(99),C$(99),D(99),E$(99)\n20 END');
  expect(basic.arrays.map(({values}) => values.length)).toEqual([64, 64, 64, 64, 0]);
  const declarations = parseProgram('10 DIM A$(1)').lines[0].statement;
  if (declarations.type !== 'DimStatement') throw Error('Expected DIM');
  expect(() => createBasicPlusMa2ArraySession(declarations.declarations)).toThrow('numeric names');
});

test('selected string state rejects numeric crossings and preserves failed read state', () => {
  const source = '10 DIM A$(1)\n20 PRINT A$(1/0)\n30 END';
  const parsed = parseProgram(source, options);
  const dim = parsed.lines[0].statement;
  const print = parsed.lines[1].statement;
  if (
    dim.type !== 'DimStatement' ||
    print.type !== 'PrintStatement' ||
    print.items[0].type !== 'ArrayReference'
  )
    throw Error('Expected string array fixture');
  const reference = print.items[0];
  const state = createBasicPlusMa2ArraySession(dim.declarations, {stringArrays: true});
  expect(state.readStringNode(reference)).toMatchObject({kind: 'numeric-event', code: 61});
  expect(state.snapshotArrays()[0].values).toEqual(['', '']);
  expect(() => state.evaluateNode(reference)).toThrow('requires a numeric array');
  expect(() => createBasicPlusMa2ArraySession().validateStringReference(reference)).toThrow(
    'selected short string array',
  );
  expect(() =>
    createBasicPlusMa2ArraySession([], {stringArrays: 'yes' as unknown as boolean}),
  ).toThrow('selection policy');
  expect(() => createSelectedMa2Session('10 PRINT A%(0)\n20 END')).toThrow(
    'short numeric or string names',
  );
  const {basic} = run('10 DIM A$(1)\n20 END');
  expect(() => basic.run(source)).toThrow('numeric-event: 61');
  expect(basic.arrays[0].values).toEqual(['', '']);
});
