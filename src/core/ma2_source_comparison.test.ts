import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {parseBasicPlusMa2NumericComparison as parse} from '../parser/parser.ts';
import {createBasicPlusMa2ScalarSession as session} from './evaluator.ts';
import comparison from './__tests__/ma2-values-reference.json';
import decimal from './__tests__/ma2-decimal-reference.json';
const operators = ['=', '<>', '<', '<=', '>', '>='] as const;
const truth: Record<-1 | 0 | 1, readonly boolean[]> = {
  [-1]: [false, true, true, true, false, false],
  0: [true, false, false, true, false, true],
  1: [false, true, false, false, true, true],
};
function rational(high: number, low: number): number {
  if (high === 0 && low === 0) return 0;
  return (
    (high >= 32768 ? -1 : 1) *
    (8388608 + (high % 128) * 65536 + low) *
    2 ** ((Math.floor(high / 128) % 256) - 152)
  );
}
const sources = new Map<string, string>();
for (const [raw, high, low, , psw, mask] of decimal.rows) {
  if (
    typeof raw !== 'string' ||
    typeof high !== 'number' ||
    typeof low !== 'number' ||
    typeof psw !== 'number' ||
    typeof mask !== 'number'
  )
    throw new Error('Invalid decimal capture');
  if (mask || psw & 2) continue;
  const key = `${high},${low}`;
  if (!sources.has(key)) sources.set(key, raw);
  if (high || low) {
    const negative = `${high ^ 32768},${low}`;
    if (!sources.has(negative)) sources.set(negative, '-' + raw);
  }
}
const joined = comparison.comparisonRows.filter(
  ([lh, ll, rh, rl]) => sources.has(`${lh},${ll}`) && sources.has(`${rh},${rl}`),
);

describe('MA2 comparison source through shared parser and scalar evaluation', () => {
  test.each(comparison.comparisonRows.map((row, i) => [i, row] as const))(
    'matches six source predicates for retained CMPF pair %i',
    (_i, [lh, ll, rh, rl, order]) => {
      if (order !== -1 && order !== 0 && order !== 1) throw new Error('Invalid order');
      const state = session();
      state.inject('A', rational(lh, ll));
      state.inject('B', rational(rh, rl));
      const before = state.snapshot();
      for (let i = 0; i < operators.length; i++)
        expect(state.compare(`A${operators[i]}B`)).toMatchObject({
          kind: 'value',
          value: truth[order][i],
          location: {label: null, start: {column: 2, offset: 1}},
        });
      expect(state.snapshot()).toEqual(before);
    },
  );
  test('joins independent decimal and comparison captures through literal source', () => {
    expect(joined.length).toBeGreaterThan(0);
    const state = session();
    for (const [lh, ll, rh, rl, order] of joined) {
      if (order !== -1 && order !== 0 && order !== 1) throw new Error('Invalid order');
      const left = sources.get(`${lh},${ll}`)!,
        right = sources.get(`${rh},${rl}`)!;
      for (let i = 0; i < operators.length; i++)
        expect(state.compare(`(${left})${operators[i]}(${right})`)).toMatchObject({
          kind: 'value',
          value: truth[order][i],
        });
    }
  });
  test('preserves complete physical spans, detached syntax and frozen boolean results', () => {
    const options = {line: 5, offset: 100},
      node = parse('\tA<=\t B', options);
    options.line = 1;
    options.offset = 0;
    expect(node).toMatchObject({
      type: 'Comparison',
      operator: '<=',
      left: {type: 'Variable', name: 'A'},
      right: {type: 'Variable', name: 'B'},
      operatorLocation: {
        label: null,
        start: {line: 5, column: 3, offset: 102},
        end: {line: 5, column: 5, offset: 104},
      },
      location: {
        label: null,
        start: {line: 5, column: 2, offset: 101},
        end: {line: 5, column: 8, offset: 107},
      },
    });
    for (const object of [
      node,
      node.left,
      node.right,
      node.location,
      node.operatorLocation,
      node.operatorLocation.start,
    ]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
    }
    const state = session();
    state.inject('A', 1 + 2 ** -23);
    state.assign('B', '1.00000011920928955078125');
    const result = state.compare('A>B', {line: 5, offset: 100});
    expect(result).toMatchObject({kind: 'value', value: true});
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => Object.assign(result, {value: false})).toThrow(TypeError);
    for (const invalid of [{line: 0}, {offset: -1}, {offset: Infinity}])
      expect(() => parse('1=2', invalid)).toThrow(RangeError);
  });
  test('preflights whole conditions and rejects unsupported or incomplete grammar without state changes', () => {
    const state = session();
    state.assign('A', '42');
    const before = state.snapshot();
    for (const source of [
      '1',
      '1 2',
      '1=',
      '1<2<3',
      '(1<2)',
      '1<2\n',
      '1<2 THEN10',
      '1==2',
      '"x"="x"',
      '1%=2',
      'RND()=0',
      '2^3=8',
      '1/0=A(1)',
      'A(1)=1/0',
    ])
      expect(() => state.compare(source)).toThrow(api.BasicSyntaxError);
    try {
      state.compare('0=B', {line: 8, offset: 90});
      throw new Error('Expected unbound');
    } catch (error) {
      expect(error).toBeInstanceOf(api.BasicRuntimeError);
      if (!(error instanceof api.BasicRuntimeError)) throw error;
      expect(error.diagnostic).toMatchObject({
        code: 'UNBOUND_MA2_SCALAR',
        line: 8,
        column: 3,
        offset: 92,
      });
    }
    expect(state.snapshot()).toEqual(before);
    expect('parseBasicPlusMa2NumericComparison' in api).toBe(false);
    expect(() =>
      api.parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2-unknown' as 'native'}),
    ).toThrow(TypeError);
  });
  test('keeps operand events and their own operator locations without committing or resuming', () => {
    const state = session();
    state.assign('A', '7');
    const before = state.snapshot();
    for (const [source, code, column] of [
      ['(1/0)=0', 61, 3],
      ['0=1/0', 61, 4],
      ['(1/0)=(1E38*10)', 61, 3],
      ['0=1E38*10', 48, 7],
    ] as const) {
      const result = state.compare(source, {line: 6, offset: 100});
      expect(result).toMatchObject({
        kind: 'numeric-event',
        code,
        location: {start: {line: 6, column, offset: 100 + column - 1}},
      });
      expect(result).not.toHaveProperty('value');
    }
    expect(state.snapshot()).toEqual(before);
  });
  test('retains native IF syntax, physical diagnostics and left-to-right callbacks', () => {
    const output: string[] = [],
      calls: number[] = [];
    const basic = new api.Basic({
      write: (text) => output.push(text),
      random: () => {
        calls.push(calls.length);
        return calls.length / 10;
      },
    });
    basic.run('10 IF RND()<RND() THEN 30\n20 PRINT "NO":END\n30 PRINT "YES"');
    expect(output).toEqual(['YES\n']);
    expect(calls).toEqual([0, 1]);
    const native = api.parseProgram('10 IF 1<=2 THEN 20\n20 END').lines[0].statement;
    expect(native).toMatchObject({
      type: 'IfStatement',
      condition: {
        operator: '<=',
        left: {type: 'NumberLiteral', value: 1},
        right: {type: 'NumberLiteral', value: 2},
        operatorLocation: {label: 10, start: {column: 8, offset: 7}},
      },
    });
    expect(() => api.parseProgram('10 IF 1 THEN 20\n20 END')).toThrow(api.BasicSyntaxError);
  });
});
