import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {ArrayStore, createBasicPlusMa2ArrayStore as store} from './arrays.ts';
import {bindMa2Words, ma2Binary, type Ma2Value} from './ma2_value.ts';
import type {ArrayDeclaration, NodeOf} from './types.ts';
function declarations(source = '10 DIM A(3)'): readonly ArrayDeclaration[] {
  const statement = api.parseProgram(source).lines[0].statement;
  if (statement.type !== 'DimStatement') throw new Error('Expected DIM');
  return statement.declarations;
}
function reference(source = 'A(0)'): NodeOf<'ArrayReference'> {
  const statement = api.parseLine('10 PRINT ' + source)?.statement;
  if (
    !statement ||
    statement.type !== 'PrintStatement' ||
    statement.items[0].type !== 'ArrayReference'
  )
    throw new Error('Expected array reference');
  return statement.items[0];
}
function bound(words: readonly number[]): Ma2Value {
  const result = bindMa2Words(words);
  if (result.kind !== 'value') throw new Error('Expected canonical words');
  return result.value;
}
const normal = (words: readonly number[]) =>
  ({kind: 'value', value: {kind: 'ma2', words: [words[0], words[1]]}}) as const;

describe('MA2 word cells in the shared ArrayStore', () => {
  test('preserves explicit zero, inclusive bounds, word-rounded intermediates and 2D order', () => {
    const arrays = store(declarations('10 DIM A(3),B(1,2)')),
      a = reference(),
      b = reference('B(0,0)');
    expect(arrays.readMa2(a, [3])).toEqual({kind: 'ma2', words: [0, 0]});
    expect(arrays.injectMa2(a, [0], 16777216)).toEqual(normal([0x4c80, 0]));
    const sum = ma2Binary(arrays.readMa2(a, [0]), 'add', bound([0x4080, 0]));
    if (sum.kind !== 'value') throw new Error('Expected sum');
    arrays.writeMa2(a, [1], sum.value);
    const difference = ma2Binary(arrays.readMa2(a, [1]), 'subtract', arrays.readMa2(a, [0]));
    expect(difference).toEqual(normal([0x4100, 0]));
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++) arrays.injectMa2(b, [i, j], i * 3 + j + 1);
    expect(arrays.snapshot()).toEqual([
      {
        name: 'A',
        bounds: [3],
        elementCount: 4,
        values: [16777216, 16777218, 0, 0],
        truncated: false,
      },
      {name: 'B', bounds: [1, 2], elementCount: 6, values: [1, 2, 3, 4, 5, 6], truncated: false},
    ]);
  });
  test('copies supplied words once and rejects unsupported values before index reads or writes', () => {
    const arrays = store(),
      empty = arrays.snapshot();
    expect(empty).toEqual([]);
    const filled = store(declarations()),
      a = reference();
    filled.injectMa2(a, [0], 7);
    const reads = [0, 0],
      words = [0x4080, 1];
    for (let i = 0; i < 2; i++) {
      const value = words[i];
      Object.defineProperty(words, i, {
        get() {
          reads[i]++;
          return value;
        },
      });
    }
    Object.defineProperty(words, Symbol.iterator, {
      get() {
        throw new Error('iterator read');
      },
    });
    expect(filled.writeMa2(a, [0], {kind: 'ma2', words: words as [number, number]})).toEqual(
      normal([0x4080, 1]),
    );
    expect(reads).toEqual([1, 1]);
    const mutable = [0x4080, 0];
    filled.writeMa2(a, [1], {kind: 'ma2', words: mutable as [number, number]});
    mutable.fill(0);
    expect(filled.readMa2(a, [1]).words).toEqual([0x4080, 0]);
    const indices = new Proxy([0], {
      get() {
        throw new Error('index read');
      },
    });
    const bad = {kind: 'ma2', words: [0x8000, 0]} as Ma2Value;
    const rejected = filled.writeMa2(a, indices, bad);
    expect(rejected).toMatchObject({kind: 'unsupported', reason: 'signed-zero'});
    for (const [input, reason] of [
      [0.1, 'precision'],
      [Infinity, 'non-finite'],
      [Number.MIN_VALUE, 'range'],
    ] as const)
      expect(filled.injectMa2(a, indices, input)).toMatchObject({kind: 'unsupported', reason});
    expect(filled.readMa2(a, [0]).words).toEqual([0x4080, 1]);
    for (const input of [null, 1, {kind: 'native', words: [0x4080, 0]}])
      expect(() => filled.writeMa2(a, [0], input as unknown as Ma2Value)).toThrow(TypeError);
    expect(() => filled.writeMa2(a, [0], {kind: 'ma2', words: [65536, 0]})).toThrow(RangeError);
  });
  test('keeps failed references/indices atomic and rejects crossing native/MA2 or CHANGE contexts', () => {
    const decl = declarations(),
      a = reference(),
      arrays = store(decl);
    arrays.injectMa2(a, [0], 9);
    const before = arrays.snapshot();
    for (const indices of [[-1], [4], [0.5], [Infinity]])
      expect(() => arrays.injectMa2(a, indices, 1)).toThrow(api.BasicRuntimeError);
    expect(() => arrays.readMa2(reference('B(0)'), [0])).toThrow(api.BasicRuntimeError);
    expect(() => arrays.injectMa2(reference('A(0,0)'), [0, 0], 1)).toThrow(api.BasicRuntimeError);
    expect(arrays.snapshot()).toEqual(before);
    expect(() => arrays.read(a, [0])).toThrow(TypeError);
    expect(() => arrays.write(a, [0], 1)).toThrow(TypeError);
    const variable = {type: 'Variable', name: 'A', location: a.location} as const;
    expect(() => arrays.changeToNumbers(variable, 'x')).toThrow(TypeError);
    expect(() => arrays.changeToString(variable)).toThrow(TypeError);
    const native = new ArrayStore(decl);
    expect(() => native.readMa2(a, [0])).toThrow(TypeError);
    expect(() => native.writeMa2(a, [0], bound([0, 0]))).toThrow(TypeError);
    expect(() => native.injectMa2(a, [0], 1)).toThrow(TypeError);
    native.write(a, [0], 2);
    expect(native.read(a, [0])).toBe(2);
    expect(() => native.read(a, [0.5])).toThrow(api.BasicRuntimeError);
  });
  test('validates declarations before allocation and retains existing bounded shape rules', () => {
    for (const source of ['10 DIM A$(1)', '10 DIM LONG(1)'])
      expect(() => store(declarations(source))).toThrow(TypeError);
    expect(() => new ArrayStore([], 'other' as 'native')).toThrow(TypeError);
    const decl = declarations()[0];
    expect(() => store([decl, decl])).toThrow(api.BasicSyntaxError);
    const oversized = {...decl, bounds: [{...decl.bounds[0], value: 65536, raw: '65536'}]};
    expect(() => store([oversized])).toThrow(api.BasicSyntaxError);
    const mutableBounds = [{...decl.bounds[0]}],
      mutable = {...decl, bounds: mutableBounds};
    const owned = store([mutable]);
    mutableBounds[0].value = 0;
    expect(owned.snapshot()[0].bounds).toEqual([3]);
  });
  test('returns bounded detached frozen exact observations and fresh independent cell ownership', () => {
    const large = store(declarations('10 DIM A(255),B(255),C(255),D(255),E(255)'));
    large.injectMa2(reference(), [0], 1 + 2 ** -23);
    const old = large.snapshot();
    expect(old.map((row) => row.values.length)).toEqual([64, 64, 64, 64, 0]);
    expect(old.every((row) => row.truncated)).toBe(true);
    expect(old[0].values[0]).toBe(1 + 2 ** -23);
    for (const object of [old, old[0], old[0].bounds, old[0].values]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(() => Object.assign(object, {extra: 1})).toThrow(TypeError);
    }
    large.injectMa2(reference(), [0], 2);
    expect(old[0].values[0]).toBe(1 + 2 ** -23);
    const fresh = store(declarations('10 DIM A(255)'));
    expect(fresh.readMa2(reference(), [0]).words).toEqual([0, 0]);
    const stored = fresh.readMa2(reference(), [0]);
    expect(Object.isFrozen(stored) && Object.isFrozen(stored.words)).toBe(true);
    expect(() => Object.assign(stored.words, {0: 1})).toThrow(TypeError);
    const mutableLocation = {
        ...reference().location,
        start: {...reference().location.start},
        end: {...reference().location.end},
      },
      ref = {...reference(), location: mutableLocation};
    const failure = fresh.injectMa2(ref, [0], 0.1);
    mutableLocation.start.column = 99;
    expect(failure).toMatchObject({kind: 'unsupported', location: {start: {column: 10}}});
    if (failure.kind !== 'unsupported') throw new Error('Expected failure');
    expect(Object.isFrozen(failure.location.start)).toBe(true);
    expect('createBasicPlusMa2ArrayStore' in api).toBe(false);
    expect(() => api.parseProgram('10 END', {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
  });
});
