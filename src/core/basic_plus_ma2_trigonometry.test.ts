import {expect, test} from 'bun:test';
import reference from './__tests__/ma2-trigonometry-reference.json';
import {basicPlusMa2Trigonometry} from './basic_plus_ma2_trigonometry.ts';
import Basic from './runtime.ts';

const operations = ['sine', 'cosine', 'tangent'] as const;

test('MA2 trigonometry reproduces the original linked routines and explicit result boundaries', () => {
  let values = 0;
  let events = 0;
  let signedZeros = 0;
  for (const [high, low, operation, event, resultHigh, resultLow] of reference.rows) {
    if (high === null || low === null || operation === null || event === null)
      throw new Error('Invalid trigonometric reference');
    const result = basicPlusMa2Trigonometry([high, low], operations[operation]);
    if (event !== 0) {
      expect(result).toMatchObject({kind: 'numeric-event', code: event});
      events++;
    } else if (resultHigh === 32768 && resultLow === 0) {
      expect(result).toEqual({kind: 'unsupported', reason: 'signed-zero'});
      signedZeros++;
    } else {
      if (resultHigh === null || resultLow === null) throw new Error('Missing captured result');
      expect(result).toEqual({kind: 'value', words: [resultHigh, resultLow]});
      values++;
    }
  }
  expect(reference.rows.length).toBe(1011);
  expect(values).toBeGreaterThan(500);
  expect(events).toBeGreaterThan(0);
  expect(signedZeros).toBe(80);
});

test('MA2 trigonometry keeps malformed and unsupported operands explicit and results detached', () => {
  expect(() => basicPlusMa2Trigonometry([], 'sine')).toThrow(RangeError);
  expect(() => basicPlusMa2Trigonometry([NaN, 0], 'sine')).toThrow(RangeError);
  expect(() => basicPlusMa2Trigonometry(['bad', 0] as unknown as number[], 'sine')).toThrow(
    RangeError,
  );
  expect(() => basicPlusMa2Trigonometry(null as unknown as number[], 'sine')).toThrow(TypeError);
  expect(basicPlusMa2Trigonometry([0x4080, 0, 0, 0], 'sine')).toMatchObject({
    kind: 'unsupported',
    reason: 'four-word-precision',
  });
  expect(basicPlusMa2Trigonometry([32768, 0], 'cosine')).toEqual({
    kind: 'unsupported',
    reason: 'signed-zero',
  });
  expect(basicPlusMa2Trigonometry([0, 1], 'tangent')).toEqual({
    kind: 'unsupported',
    reason: 'zero-exponent-fraction',
  });
  expect(() => basicPlusMa2Trigonometry([0, 0], 'sqrt' as 'sine')).toThrow(RangeError);
  const input = [0x4080, 0];
  const result = basicPlusMa2Trigonometry(input, 'sine');
  input[0] = 0;
  expect(result).toEqual({kind: 'value', words: [16471, 27301]});
  let reads = 0;
  const observed = [0x4080, 0];
  Object.defineProperty(observed, 0, {
    get: () => {
      reads++;
      return reads === 1 ? 0x4080 : 0;
    },
  });
  expect(basicPlusMa2Trigonometry(observed, 'sine')).toEqual({
    kind: 'value',
    words: [16471, 27301],
  });
  expect(reads).toBe(1);
  expect(Object.isFrozen(result)).toBe(true);
  if (result.kind === 'value') expect(Object.isFrozen(result.words)).toBe(true);
});

test('selected SIN, COS and TAN use exact values, locate events, and preserve native names', () => {
  const basic = new Basic({}, {dialect: 'basic-plus-v4a12-ma2'});
  basic.run('10 A=SIN(1):B=COS(-1):C=TAN(262136)\n20 END');
  expect(basic.variables).toEqual([
    {name: 'A', value: 0.8414710164070129},
    {name: 'B', value: 0.5403023958206177},
    {name: 'C', value: 13.556670188903809},
  ]);
  expect(() => basic.run('10 A=TAN(1E20)')).toThrow('MA2 numeric-event: 61');
  expect(basic.state.diagnostic).toMatchObject({code: 'MA2_NUMERIC_EVENT', label: 10, column: 6});
  expect(() => basic.run('10 A=SIN(-1E20)')).toThrow('signed-zero');
  expect(basic.state.diagnostic).toMatchObject({code: 'UNSUPPORTED_MA2_VALUE', label: 10});
  const native = new Basic();
  native.run('10 SIN=1:COS=2:TAN=3');
  expect(native.variables).toEqual([
    {name: 'SIN', value: 1},
    {name: 'COS', value: 2},
    {name: 'TAN', value: 3},
  ]);
});
