import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {
  createBasicPlusMa2ScalarSession as session,
  evaluateBasicPlusMa2Constant,
} from './evaluator.ts';
import decimal from './__tests__/ma2-decimal-reference.json';

const normal = (words: readonly number[]) =>
  ({kind: 'value', value: {kind: 'ma2', words: [words[0], words[1]]}}) as const;

describe('word-preserving MA2 scalar conformance on the shared driver', () => {
  test.each(decimal.rows.map((row, i) => [i, row] as const))(
    'assigns retained source capture %i atomically',
    (_i, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Invalid capture');
      const state = session();
      state.assign('A', '42');
      if (mask !== 0 || (psw & 2) !== 0) {
        expect(() => state.assign('A', raw)).toThrow(api.BasicSyntaxError);
        expect(state.snapshot()).toEqual([{name: 'A', value: 42}]);
      } else {
        expect(state.assign('A', raw)).toEqual(normal([high, low]));
        expect(state.evaluate('A')).toEqual(normal([high, low]));
      }
    },
  );
  test('retains words across assignments and observes exact detached numeric snapshots', () => {
    const state = session();
    state.assign('A', '16777216');
    state.assign('B', 'A+1');
    state.assign('C', 'B-A');
    expect(state.evaluate('C')).toEqual(normal([0x4100, 0]));
    expect(state.snapshot()).toEqual([
      {name: 'A', value: 16777216},
      {name: 'B', value: 16777218},
      {name: 'C', value: 2},
    ]);
    expect(state.assign('A', 'ABS(-C)+INT(-.5)')).toEqual(normal([0x4080, 0]));
    const prior = state.snapshot();
    expect(Object.isFrozen(prior)).toBe(true);
    for (const row of prior) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(() => Object.assign(row, {value: 0})).toThrow(TypeError);
    }
    state.assign('A', '9');
    expect(prior[0]).toEqual({name: 'A', value: 1});
    expect(state.snapshot()[0]).toEqual({name: 'A', value: 9});
  });
  test('keeps exact host injection separate from source conversion and rejects unsupported values before commit', () => {
    const state = session();
    expect(state.inject('A', 1 + 2 ** -23)).toEqual(normal([0x4080, 1]));
    expect(state.evaluate('A-1')).toEqual(normal([0x3500, 0]));
    expect(state.assign('B', '1.00000011920928955078125')).toEqual(normal([0x4080, 0]));
    expect(state.snapshot()).toEqual([
      {name: 'A', value: 1 + 2 ** -23},
      {name: 'B', value: 1},
    ]);
    for (const [input, reason] of [
      [0.1, 'precision'],
      [Infinity, 'non-finite'],
      [Number.MIN_VALUE, 'range'],
    ] as const) {
      expect(state.inject('A', input, {line: 6, offset: 100})).toEqual({
        kind: 'unsupported',
        reason,
        location: {
          label: null,
          start: {line: 6, column: 1, offset: 100},
          end: {line: 6, column: 2, offset: 101},
        },
      });
      expect(state.evaluate('A')).toEqual(normal([0x4080, 1]));
    }
    expect(state.inject('Z', -0)).toEqual(normal([0, 0]));
    for (const input of [
      null,
      '1',
      Object(1),
      {
        valueOf() {
          throw new Error('coerced');
        },
      },
    ])
      expect(() => state.inject('A', input as number)).toThrow(TypeError);
  });
  test('keeps failed source, unbound reads, unsupported targets and events atomic with physical locations', () => {
    const state = session();
    state.assign('A', '42');
    const event = state.assign('A', '1/0', {line: 8, offset: 90});
    expect(event).toMatchObject({
      kind: 'numeric-event',
      code: 61,
      location: {start: {line: 8, column: 2, offset: 91}},
    });
    expect(state.snapshot()).toEqual([{name: 'A', value: 42}]);
    expect(state.assign('A', '1E38*10').kind).toBe('numeric-event');
    expect(state.snapshot()).toEqual([{name: 'A', value: 42}]);
    try {
      state.assign('A', ' B+1', {line: 9, offset: 200});
      throw new Error('Expected unbound rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(api.BasicRuntimeError);
      if (!(error instanceof api.BasicRuntimeError)) throw error;
      expect(error.diagnostic).toMatchObject({
        code: 'UNBOUND_MA2_SCALAR',
        label: null,
        line: 9,
        column: 2,
        offset: 201,
      });
    }
    for (const name of ['A(1)', 'A+1', '1', 'A$', 'A%', 'a', 'LONG', 'INT(1)'])
      expect(() => state.assign(name, '1/0')).toThrow(api.BasicSyntaxError);
    for (const name of [null, 1, {}, undefined])
      expect(() => state.inject(name as string, 1)).toThrow(TypeError);
    for (const source of ['1+', '1E999', 'RND', 'A(1)', '(1/0)+A(1)'])
      expect(() => state.assign('A', source)).toThrow(api.BasicSyntaxError);
    expect(state.snapshot()).toEqual([{name: 'A', value: 42}]);
  });
  test('owns independent/reset state, retains constant-only/public gates and native behavior', () => {
    const a = session(),
      b = session();
    a.assign('A', '1');
    b.assign('A', '2');
    expect(a.evaluate('A')).toEqual(normal([0x4080, 0]));
    expect(b.evaluate('A')).toEqual(normal([0x4100, 0]));
    const prior = a.snapshot();
    a.reset();
    expect(a.snapshot()).toEqual([]);
    expect(() => a.evaluate('A')).toThrow('Unbound MA2 conformance scalar');
    expect(prior).toEqual([{name: 'A', value: 1}]);
    expect(b.snapshot()).toEqual([{name: 'A', value: 2}]);
    a.assign('A1', '3');
    expect(a.evaluate(Array(6000).fill('A1').join('+'))).toEqual(normal([0x478c, 0xa000]));
    expect(() => evaluateBasicPlusMa2Constant('A1')).toThrow(api.BasicSyntaxError);
    expect('createBasicPlusMa2ScalarSession' in api).toBe(false);
    const native = new api.Basic();
    native.run('10 A=1.0000001\n20 B=A-1');
    expect(native.variables[0]).toEqual({name: 'A', value: 1.0000001});
    expect(() => api.parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
  });
});
