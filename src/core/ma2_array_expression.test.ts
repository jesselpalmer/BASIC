import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {
  createBasicPlusMa2ArraySession as session,
  createBasicPlusMa2ScalarSession,
  evaluateBasicPlusMa2Constant,
} from './evaluator.ts';
import reference from './__tests__/ma2-decimal-reference.json';
import type {ArrayDeclaration} from './types.ts';

function declarations(source = '10 DIM A(3),B(2,3)'): readonly ArrayDeclaration[] {
  const statement = api.parseProgram(source).lines[0].statement;
  if (statement.type !== 'DimStatement') throw Error('Expected DIM');
  return statement.declarations;
}
function normal(words: readonly [number, number]) {
  return {kind: 'value', value: {kind: 'ma2', words}} as const;
}
function diagnostic(action: () => unknown) {
  try {
    action();
    throw Error('Expected rejection');
  } catch (error) {
    if (!(error instanceof api.BasicRuntimeError || error instanceof api.BasicSyntaxError))
      throw error;
    return error.diagnostic;
  }
}

describe('shared MA2 array-expression conformance', () => {
  test.each(reference.rows.map((row, i) => [i, row] as const))(
    'retains source capture %i through an element assignment',
    (_i, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw Error('Invalid capture');
      const state = session(declarations());
      state.assignElement('A(0)', '42');
      if (mask !== 0 || (psw & 2) !== 0) {
        expect(() => state.assignElement('A(0)', raw)).toThrow(api.BasicSyntaxError);
        expect(state.evaluate('A(0)')).toEqual(normal([0x4328, 0]));
      } else {
        expect(state.assignElement('A(0)', raw)).toEqual(normal([high, low]));
        expect(state.evaluate('A(0)')).toEqual(normal([high, low]));
      }
    },
  );
  test('retains rounded words across scalar/array arithmetic, nested reads and comparisons', () => {
    const state = session(declarations());
    state.assign('A', '16777216');
    state.assignElement('A(0)', 'A+1');
    state.assignElement('B(2,3)', 'A(0)-A');
    expect(state.evaluate('B(2,3)')).toEqual(normal([0x4100, 0]));
    state.assignElement('A(1)', '2');
    state.assignElement('A(2)', '3');
    expect(state.evaluate('B(A(1),A(2))')).toEqual(normal([0x4100, 0]));
    expect(state.evaluate('A(1.00000011920928955078125)')).toEqual(normal([0x4100, 0]));
    expect(state.compare('B(2,3)=2')).toMatchObject({kind: 'value', value: true});
    expect(state.compare('A(0)>A')).toMatchObject({kind: 'value', value: true});
    state.assign('C', 'ABS(-B(2,3))+INT(-.5)');
    expect(state.evaluate('C')).toEqual(normal([0x4080, 0]));
    expect(state.injectElement('A(3)', 1 + 2 ** -23)).toEqual(normal([0x4080, 1]));
    expect(state.evaluate('A(3)-1')).toEqual(normal([0x3500, 0]));
    state.assignElement('A(0)', '1.00000011920928955078125');
    expect(state.compare('A(3)>A(0)')).toMatchObject({kind: 'value', value: true});
    expect(state.evaluate(Array(3000).fill('A(3)').join('+')).kind).toBe('value');
  });
  test('preflights both complete sides, nested references and target indices before numeric work', () => {
    const state = session(declarations());
    for (const source of ['(1/0)+C(0)', 'A(1/0)+B(0)', 'A(C(0))', 'B(0,1/0)+C(0)'])
      expect(diagnostic(() => state.evaluate(source)).code).toMatch(
        /UNDECLARED_ARRAY|ARRAY_RANK_MISMATCH/,
      );
    expect(diagnostic(() => state.compare('1/0=C(0)')).code).toBe('UNDECLARED_ARRAY');
    expect(diagnostic(() => state.compare('C(0)=1/0')).code).toBe('UNDECLARED_ARRAY');
    expect(diagnostic(() => state.assignElement('A(C(0))', '1/0')).code).toBe('UNDECLARED_ARRAY');
    expect(diagnostic(() => state.assignElement('A(1/0)', 'C(0)')).code).toBe('UNDECLARED_ARRAY');
    for (const target of ['A', '1', 'A(0)+1', 'A$', 'A%(0)'])
      expect(() => state.assignElement(target, '1/0')).toThrow(api.BasicSyntaxError);
    for (const source of ['A(0)+', 'A(0):A(1)', 'A(0)+RND()', 'A(0)+"X"'])
      expect(() => state.evaluate(source)).toThrow(api.BasicSyntaxError);
  });
  test('keeps RHS and index failures atomic, stops events and retains physical locations', () => {
    const state = session(declarations());
    state.assignElement('B(0,0)', '7');
    const before = state.snapshotArrays();
    // RHS wins before target index work; first index wins before later reads.
    expect(state.assignElement('B(Z,0)', '1/0', {line: 8, offset: 100})).toMatchObject({
      kind: 'numeric-event',
      code: 61,
      location: {start: {line: 8, column: 2, offset: 101}},
    });
    expect(state.assignElement('B(1/0,Z)', '9', {line: 8, offset: 100})).toMatchObject({
      kind: 'numeric-event',
      code: 61,
      location: {start: {line: 8, column: 4, offset: 103}},
    });
    expect(state.evaluate('B(1/0,Z)')).toMatchObject({kind: 'numeric-event', code: 61});
    expect(diagnostic(() => state.evaluate('B(Z,1/0)')).code).toBe('UNBOUND_MA2_SCALAR');
    expect(state.compare('A(1/0)=Z')).toMatchObject({kind: 'numeric-event', code: 61});
    expect(state.compare('1=A(1/0)')).toMatchObject({kind: 'numeric-event', code: 61});
    for (const [input, reason] of [
      [0.1, 'precision'],
      [Infinity, 'non-finite'],
      [Number.MIN_VALUE, 'range'],
    ] as const)
      expect(state.injectElement('B(Z,0)', input)).toMatchObject({kind: 'unsupported', reason});
    expect(() => state.injectElement('B(0,0)', '1' as unknown as number)).toThrow(TypeError);
    expect(state.assignElement('B(0,0)', '1E38*10')).toMatchObject({
      kind: 'numeric-event',
      code: 48,
    });
    for (const source of ['A(1E30)', 'A(32768)', 'A(-32769)']) {
      expect(diagnostic(() => state.evaluate(source)).code).toBe('MA2_INTEGER_CONVERSION');
      expect(diagnostic(() => state.assignElement(source, '9')).code).toBe(
        'MA2_INTEGER_CONVERSION',
      );
    }
    for (const source of ['A(-1)', 'A(4)']) {
      expect(diagnostic(() => state.evaluate(source)).code).toBe('MA2_SUBSCRIPT_BOUNDS');
      expect(diagnostic(() => state.assignElement(source, '9')).code).toBe('MA2_SUBSCRIPT_BOUNDS');
    }
    expect(state.snapshotArrays()).toEqual(before);
    const event = state.evaluate('A(1/0)');
    expect(Object.isFrozen(event)).toBe(true);
    if (event.kind === 'numeric-event') expect(Object.isFrozen(event.continuation)).toBe(true);
    expect(diagnostic(() => state.evaluate(' A(32768)', {line: 9, offset: 200}))).toMatchObject({
      code: 'MA2_INTEGER_CONVERSION',
      line: 9,
      column: 4,
      offset: 203,
    });
  });
  test('uses selected signed-word truncation for read and write subscripts', () => {
    const state = session(declarations());
    state.assignElement('A(.5)', '11');
    state.assignElement('A(1.5)', '22');
    state.assignElement('A(3.5)', '33');
    expect(state.evaluate('A(-.9)')).toEqual(normal([0x4230, 0]));
    expect(state.evaluate('A(1.9)')).toEqual(normal([0x42b0, 0]));
    expect(state.evaluate('A(3.5)')).toEqual(normal([0x4304, 0]));
    for (const source of ['A(-1)', 'A(4.1)', 'A(32767)', 'A(-32768)'])
      expect(diagnostic(() => state.evaluate(source)).code).toBe('MA2_SUBSCRIPT_BOUNDS');
    expect(diagnostic(() => state.evaluate('A(32768)')).code).toBe('MA2_INTEGER_CONVERSION');
  });
  test('owns fresh stores, bounded detached snapshots and atomic declaration resets', () => {
    const dim = declarations();
    const a = session(dim),
      b = session(dim);
    expect(a.snapshotArrays()[0].values).toEqual([0, 0, 0, 0]);
    a.assignElement('A(0)', '5');
    a.assign('A', '9');
    const prior = a.snapshotArrays();
    expect(Object.isFrozen(prior)).toBe(true);
    expect(Object.isFrozen(prior[0])).toBe(true);
    expect(Object.isFrozen(prior[0].values)).toBe(true);
    expect(b.evaluate('A(0)')).toEqual(normal([0, 0]));
    expect(() => a.reset([...dim, ...dim])).toThrow(api.BasicSyntaxError);
    expect(a.evaluate('A(0)')).toEqual(normal([0x41a0, 0]));
    expect(a.snapshot()).toEqual([{name: 'A', value: 9}]);
    a.reset(dim);
    expect(a.evaluate('A(0)')).toEqual(normal([0, 0]));
    expect(a.snapshot()).toEqual([]);
    expect(prior[0].values[0]).toBe(5);
    a.reset();
    expect(a.snapshotArrays()).toEqual([]);
    expect(() => a.evaluate('A(0)')).toThrow('requires DIM');
    const big = session(declarations('10 DIM A(1000)'));
    expect(big.snapshotArrays()[0]).toMatchObject({elementCount: 1001, truncated: true});
    expect(big.snapshotArrays()[0].values).toHaveLength(64);
    expect(() => session(declarations('10 DIM LONG(1)'))).toThrow(TypeError);
    expect(() => session(null as unknown as readonly ArrayDeclaration[])).toThrow(TypeError);
    expect(session().snapshotArrays()).toEqual([]);
    const scalar = createBasicPlusMa2ScalarSession();
    expect(scalar.snapshotArrays()).toEqual([]);
    expect(() => scalar.evaluate('A(0)')).toThrow(api.BasicSyntaxError);
    expect(() => scalar.assignElement('A(0)', '1')).toThrow(api.BasicSyntaxError);
    expect(() => evaluateBasicPlusMa2Constant('A(0)')).toThrow(api.BasicSyntaxError);
    scalar.assign('A', '3');
    scalar.reset();
    expect(scalar.snapshot()).toEqual([]);
    expect('createBasicPlusMa2ArraySession' in api).toBe(false);
    expect(() =>
      api.parseProgram('10 DIM A(1)', {dialect: 'basic-plus-v4a12-ma2-unknown' as 'native'}),
    ).toThrow(TypeError);
    const native = new api.Basic();
    expect(() => native.run('10 DIM A(1)\n20 PRINT A(.5)')).toThrow(api.BasicRuntimeError);
  });
});
