import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseProgram} from '../index.ts';
import {
  BASIC_PLUS_STRING_LIMIT,
  basicPlusStringRelation as relation,
} from './basic_plus_strings.ts';
import type {ComparisonOperator} from './types.ts';

const operators = ['=', '<>', '<', '<=', '>', '>='] as const;

function expectRelations(left: string, right: string, expected: readonly (-1 | 0)[]) {
  for (let index = 0; index < operators.length; index++)
    expect(relation(left, operators[index], right)).toEqual({
      kind: 'value',
      value: expected[index],
    });
}

describe('internal BASIC-PLUS string relations', () => {
  it('maps every relation to independently authored true/false logical words', () => {
    expectRelations('ALPHA', 'BETA', [0, -1, -1, -1, 0, 0]);
    expectRelations('BETA', 'ALPHA', [0, -1, 0, 0, -1, -1]);
    expectRelations('SAME', 'SAME', [-1, 0, 0, -1, 0, -1]);
  });

  it('uses the manual YES/YES-blank equivalence and null-string rule', () => {
    for (const [left, right] of [
      ['YES', 'YES '],
      ['YES  ', 'YES'],
      ['', ''],
      ['', '   '],
      ['  ', ' '],
    ])
      expectRelations(left, right, [-1, 0, 0, -1, 0, -1]);
    expectRelations('', 'A', [0, -1, -1, -1, 0, 0]);
    expectRelations('A', '', [0, -1, 0, 0, -1, -1]);
    expectRelations('   ', ' A', [0, -1, -1, -1, 0, 0]);
  });

  it('preserves leading/embedded blanks and compares through padded prefixes', () => {
    expectRelations(' A', 'A', [0, -1, -1, -1, 0, 0]);
    expectRelations('A B', 'AB', [0, -1, -1, -1, 0, 0]);
    expectRelations('A', 'AA', [0, -1, -1, -1, 0, 0]);
    expectRelations('AB', 'A A', [0, -1, 0, 0, -1, -1]);
    expectRelations('A B ', 'A B', [-1, 0, 0, -1, 0, -1]);
  });

  it('checks every uppercase letter and blank pair against alphabet positions', () => {
    const alphabet = [' ', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    for (let left = 0; left < alphabet.length; left++)
      for (let right = 0; right < alphabet.length; right++) {
        const expected = [
          left === right,
          left !== right,
          left < right,
          left <= right,
          left > right,
          left >= right,
        ];
        for (let index = 0; index < operators.length; index++)
          expect(relation(alphabet[left], operators[index], alphabet[right])).toEqual({
            kind: 'value',
            value: expected[index] ? -1 : 0,
          });
      }
  });

  it('supports byte equality with only ASCII blank padding and no high-bit stripping', () => {
    for (let code = 0; code < 256; code++) {
      const byte = String.fromCharCode(code);
      expect(relation(byte, '=', byte + ' ')).toEqual({kind: 'value', value: -1});
      expect(relation(byte + ' ', '<>', byte)).toEqual({kind: 'value', value: 0});
    }
    for (const [left, right] of [
      ['A', '\u00c1'],
      ['\0', '\u0080'],
      ['A', 'a'],
      ['', '\0'],
      ['', '\t'],
      ['YES', 'YES\t'],
    ]) {
      expect(relation(left, '=', right)).toEqual({kind: 'value', value: 0});
      expect(relation(left, '<>', right)).toEqual({kind: 'value', value: -1});
    }
    expect(relation('A ', '=', ' A')).toEqual({kind: 'value', value: 0});
  });

  it.each(['a', '0', '!', '~', '\0', '\t', '\n', '\r', '\u007f', '\u0080', '\u00ff'])(
    'keeps unsettled ordered collation explicit for %s',
    (byte) => {
      for (const operator of ['<', '<=', '>', '>='] as const) {
        for (const [left, right] of [
          [byte, 'A'],
          ['A', byte],
          ['A' + byte, 'Z'],
          ['Z', 'A' + byte],
        ])
          expect(relation(left, operator, right)).toEqual({
            kind: 'unsupported',
            reason: 'comparison-domain',
          });
      }
    },
  );

  it('validates complete byte domains before computing equality or early differences', () => {
    for (const bad of ['A\u0100', 'A🙂', '\ud800'])
      for (const operator of operators) {
        expect(relation(bad, operator, 'Z')).toEqual({
          kind: 'unsupported',
          reason: 'character-domain',
        });
        expect(relation('Z', operator, bad)).toEqual({
          kind: 'unsupported',
          reason: 'character-domain',
        });
      }
    // Even an unsupported left operand does not hide a malformed right type.
    expect(() => {
      Reflect.apply(relation, null, ['\u0100', '=', 1]);
    }).toThrow(TypeError);
  });

  it('accepts exact resource limits and rejects either over-limit operand', () => {
    const full = 'A'.repeat(BASIC_PLUS_STRING_LIMIT);
    expectRelations(full, full, [-1, 0, 0, -1, 0, -1]);
    expectRelations(full, full.slice(0, -1), [0, -1, 0, 0, -1, -1]);
    expectRelations('', ' '.repeat(BASIC_PLUS_STRING_LIMIT), [-1, 0, 0, -1, 0, -1]);
    for (const operator of operators) {
      expect(relation(full + 'A', operator, '')).toEqual({
        kind: 'unsupported',
        reason: 'string-limit',
      });
      expect(relation('', operator, full + 'A')).toEqual({
        kind: 'unsupported',
        reason: 'string-limit',
      });
    }
  });

  it('rejects unsupported operators and malformed types without coercion', () => {
    for (const operator of ['==', '!=', 'EQ', '', null, 1, {}])
      expect(() => {
        Reflect.apply(relation, null, ['A', operator, 'A']);
      }).toThrow(RangeError);
    for (const operand of [null, undefined, 1, true, {}, new String('A')]) {
      expect(() => {
        Reflect.apply(relation, null, [operand, '=', 'A']);
      }).toThrow(TypeError);
      expect(() => {
        Reflect.apply(relation, null, ['A', '=', operand]);
      }).toThrow(TypeError);
    }
  });

  it('returns frozen independent values and unsupported outcomes', () => {
    const value = relation('A', '<', 'B'),
      unsupported = relation('a', '<', 'B');
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(unsupported)).toBe(true);
    expect(() => Object.assign(value, {value: 1})).toThrow(TypeError);
    expect(() => Object.assign(unsupported, {reason: 'changed'})).toThrow(TypeError);
    expect(relation('B', '<', 'A')).toEqual({kind: 'value', value: 0});
    expect(relation('A', '<', 'B')).toEqual(value);
  });

  it('retains native exact equality, ordered-string rejection and public profile gating', () => {
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    basic.run(
      '10 IF "YES"="YES " THEN PRINT "wrong" ELSE PRINT "exact"\n20 IF ""=" " THEN PRINT "wrong" ELSE PRINT "empty"',
    );
    expect(output).toEqual(['exact\n', 'empty\n']);
    for (const operator of ['<', '<=', '>', '>='] satisfies ComparisonOperator[])
      expect(() => basic.run(`10 PRINT "never"\n20 IF "A"${operator}"B" THEN END`)).toThrow(
        BasicSyntaxError,
      );
    expect(output).toEqual(['exact\n', 'empty\n']);
    const options = {dialect: 'native' as const};
    Reflect.set(options, 'dialect', 'basic-plus-1972-10');
    expect(() => parseProgram('10 END', options)).toThrow(TypeError);
    basic.run('10 PRINT "kept"');
    expect(output).toEqual(['exact\n', 'empty\n', 'kept\n']);
  });
});
