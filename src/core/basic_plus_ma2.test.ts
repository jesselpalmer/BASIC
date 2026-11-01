import {describe, expect, test} from 'bun:test';
import {basicPlusMa2Arithmetic, type BasicPlusMa2Operation} from './basic_plus_ma2.ts';
import reference from './__tests__/ma2-addition-reference.json';

const one = [0x4080, 0];

describe('internal pinned V4A MA2 arithmetic', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'matches independently executed machine vector %i',
    (_index, row) => {
      expect(row).toHaveLength(8);
      const [lh, ll, operation, rh, rl, outcome, high, low] = row;
      if (
        lh === null ||
        ll === null ||
        rh === null ||
        rl === null ||
        operation === null ||
        outcome === null
      ) {
        throw new Error('Invalid reference operand');
      }
      expect([0, 1]).toContain(operation);
      expect([0, 1, 2]).toContain(outcome);
      const actual = basicPlusMa2Arithmetic([lh, ll], operation === 0 ? 'add' : 'subtract', [
        rh,
        rl,
      ]);
      if (outcome === 0) {
        if (high === null || low === null) throw new Error('Missing reference result');
        expect(actual).toEqual({kind: 'value', words: [high, low]});
      } else {
        // The harness records the trap PC, not the unfinished scratch result.
        expect([high, low]).toEqual([null, null]);
        expect(actual).toEqual({
          kind: 'numeric-event',
          code: 48,
          reason: outcome === 1 ? 'overflow' : 'underflow',
        });
      }
    },
  );

  test('preserves the selected reference identity and every captured outcome', () => {
    expect(reference.loaderSha256).toBe(
      'e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596',
    );
    expect(reference.simulatorCommit).toBe('698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6');
    expect([0, 1, 2].map((kind) => reference.rows.filter((row) => row[5] === kind).length)).toEqual(
      [480, 10, 6],
    );
  });

  test('keeps the BASIC same-sign and opposite-sign halfway observations distinct', () => {
    expect(basicPlusMa2Arithmetic(one, 'add', [0x3480, 0])).toEqual({
      kind: 'value',
      words: [0x4080, 1],
    });
    expect(basicPlusMa2Arithmetic(one, 'subtract', [0x3400, 0])).toEqual({
      kind: 'value',
      words: [0x407f, 0xffff],
    });
    expect(basicPlusMa2Arithmetic([0xc080, 0], 'add', [0x3400, 0])).toEqual({
      kind: 'value',
      words: [0xc07f, 0xffff],
    });
  });

  test.each(['left', 'right'] as const)('keeps unsupported %s encodings explicit', (operand) => {
    for (const [words, reason] of [
      [[0x4080, 0, 0, 0], 'four-word-precision'],
      [[0x8000, 0], 'signed-zero'],
      [[0, 1], 'zero-exponent-fraction'],
    ] as const) {
      const result = basicPlusMa2Arithmetic(
        operand === 'left' ? words : one,
        'add',
        operand === 'right' ? words : one,
      );
      expect(result).toEqual({kind: 'unsupported', operand, reason});
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  test('validates the operation before either operand and stops on unsupported left', () => {
    const unreadable = new Proxy([], {
      get() {
        throw new Error('operand read');
      },
    });
    expect(() =>
      basicPlusMa2Arithmetic(unreadable, 'multiply' as BasicPlusMa2Operation, unreadable),
    ).toThrow('Unsupported MA2 arithmetic operation');
    expect(basicPlusMa2Arithmetic([0, 1], 'subtract', unreadable)).toEqual({
      kind: 'unsupported',
      operand: 'left',
      reason: 'zero-exponent-fraction',
    });
  });

  test.each(['left', 'right'] as const)(
    'rejects malformed %s operands through the shared decoder',
    (operand) => {
      for (const malformed of [
        null,
        '1',
        new Uint16Array(2),
        [],
        [1],
        [1, 2, 3],
        [65536, 0],
        [-1, 0],
        [NaN, 0],
        [0, Infinity],
        [0, 0.5],
        new Array(2),
      ]) {
        const input = malformed as unknown as readonly number[];
        expect(() =>
          basicPlusMa2Arithmetic(
            operand === 'left' ? input : one,
            'add',
            operand === 'right' ? input : one,
          ),
        ).toThrow();
      }
    },
  );

  test('reads each operand word once, never iterates caller arrays, and retains no input', () => {
    const left = [0x4080, 0];
    const right = [0x3480, 0];
    const reads: string[] = [];
    for (const [name, words] of [
      ['left', left],
      ['right', right],
    ] as const) {
      const values = words.slice();
      for (let index = 0; index < 2; index++) {
        Object.defineProperty(words, index, {
          get() {
            reads.push(`${name}${index}`);
            return values[index];
          },
        });
      }
      Object.defineProperty(words, Symbol.iterator, {
        value() {
          throw new Error('caller iterator');
        },
      });
    }
    const result = basicPlusMa2Arithmetic(left, 'add', right);
    expect(reads).toEqual(['left0', 'left1', 'right0', 'right1']);
    expect(result).toEqual({kind: 'value', words: [0x4080, 1]});
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind !== 'value') throw new Error('Expected value');
    expect(Object.isFrozen(result.words)).toBe(true);
    expect(() => Object.assign(result.words, {0: 0})).toThrow(TypeError);
    expect(() => Object.assign(result, {kind: 'unsupported'})).toThrow(TypeError);
  });

  test('detaches identity results and leaves range continuation unresolved', () => {
    const source = [0xc1a0, 0];
    const result = basicPlusMa2Arithmetic([0, 0], 'add', source);
    source.fill(0);
    expect(result).toEqual({kind: 'value', words: [0xc1a0, 0]});
    const event = basicPlusMa2Arithmetic([0x7fff, 0xffff], 'add', [0x7fff, 0xffff]);
    expect(event.kind).toBe('numeric-event');
    expect(Object.isFrozen(event)).toBe(true);
    if (event.kind !== 'numeric-event') throw new Error('Expected range event');
    expect(event).not.toHaveProperty('words');
    expect(() => Object.assign(event, {code: 0})).toThrow(TypeError);
  });

  test('propagates accessor failures without mutating the other operand', () => {
    const left = [0x4080, 0];
    Object.defineProperty(left, 1, {
      get() {
        throw new Error('word getter failed');
      },
    });
    const right = Object.freeze([0x4080, 0]);
    expect(() => basicPlusMa2Arithmetic(left, 'add', right)).toThrow('word getter failed');
    expect(right).toEqual([0x4080, 0]);
  });
});
