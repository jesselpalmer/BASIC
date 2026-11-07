import {describe, expect, test} from 'bun:test';
import * as api from '../index.ts';
import {basicPlusStringConcat as concat} from './basic_plus_strings.ts';
import {compareBasicPlusStringRelation as compare} from './comparison.ts';
import type {ComparisonOperator} from './types.ts';

const value = <T>(value: T) => ({kind: 'value' as const, value});
const operators: readonly ComparisonOperator[] = ['=', '<>', '<', '<=', '>', '>='];

describe('bounded BASIC-PLUS string values through shared comparison', () => {
  test('concatenates exact characters and blanks, including every byte in either position', () => {
    expect(concat('ABC', 'DEF')).toEqual(value('ABCDEF'));
    expect(concat('ABC ', ' DEF')).toEqual(value('ABC  DEF'));
    expect(concat('', '')).toEqual(value(''));
    expect(concat(' A ', '')).toEqual(value(' A '));
    expect(concat('', ' A ')).toEqual(value(' A '));
    for (let byte = 0; byte < 256; byte++) {
      const character = String.fromCharCode(byte);
      expect(concat(character, 'B')).toEqual(value(character + 'B'));
      expect(concat('A', character)).toEqual(value('A' + character));
      expect(compare(character, '=', character + ' ')).toEqual(value(true));
      expect(compare(character, '<>', character)).toEqual(value(false));
      expect(compare(character, '=', String.fromCharCode((byte + 128) % 256))).toEqual(
        value(false),
      );
    }
    expect(concat('a\0\u0080', '\u00ff A ')).toEqual(value('a\0\u0080\u00ff A '));
    const a = concat('YES', ' ');
    if (a.kind !== 'value') throw Error('Expected string');
    expect(compare(a.value, '=', 'YES')).toEqual(value(true));
    expect(compare('YES', '=', ' YES')).toEqual(value(false));
    expect(compare('A B', '=', 'AB')).toEqual(value(false));
    expect(compare('', '=', '   ')).toEqual(value(true));
    expect(compare('A\t', '=', 'A')).toEqual(value(false));
  });
  test('binds all six predicates using independent alphabet and conceptual-padding expectations', () => {
    const alphabet = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let a = 0; a < alphabet.length; a++)
      for (let b = 0; b < alphabet.length; b++) {
        const expected = [a === b, a !== b, a < b, a <= b, a > b, a >= b];
        for (let i = 0; i < operators.length; i++)
          expect(compare(alphabet[a], operators[i], alphabet[b] + ' ')).toEqual(value(expected[i]));
      }
    for (const [a, b, expected] of [
      ['A', 'AB', true],
      ['A B', 'AB', true],
      ['', 'A', true],
      ['Z', 'AA', false],
    ] as const)
      expect(compare(a, '<', b)).toEqual(value(expected));
    for (const byte of ['0', 'a', '\0', '\u00ff', '!', '\t'])
      for (const operator of ['<', '<=', '>', '>='] as const) {
        expect(compare('A' + byte, operator, 'Z')).toEqual({
          kind: 'unsupported',
          reason: 'comparison-domain',
        });
        expect(compare('A', operator, 'Z' + byte)).toEqual({
          kind: 'unsupported',
          reason: 'comparison-domain',
        });
      }
  });
  test('checks both complete domains and combined length before allocating a value', () => {
    const full = 'A'.repeat(32767),
      half = 'A'.repeat(16383);
    expect(concat(full, '')).toEqual(value(full));
    expect(concat('', full)).toEqual(value(full));
    expect(concat(half, half + 'A')).toEqual(value(full));
    expect(concat(full, 'B')).toEqual({kind: 'unsupported', reason: 'string-limit'});
    expect(concat('B', full)).toEqual({kind: 'unsupported', reason: 'string-limit'});
    expect(concat(half + 'A', half + 'B')).toEqual({kind: 'unsupported', reason: 'string-limit'});
    for (const source of ['A\u0100', 'A\ud800', 'A🙂']) {
      expect(concat(source, '')).toEqual({kind: 'unsupported', reason: 'character-domain'});
      expect(concat('', source)).toEqual({kind: 'unsupported', reason: 'character-domain'});
      expect(compare(source, '=', 'Z')).toEqual({kind: 'unsupported', reason: 'character-domain'});
      expect(compare('A', '<>', 'Z' + source)).toEqual({
        kind: 'unsupported',
        reason: 'character-domain',
      });
    }
    for (const [left, right] of [
      [full + 'A', ''],
      ['', full + 'A'],
      [full + 'A', '\u0100'],
      ['\u0100', full + 'A'],
    ]) {
      expect(concat(left, right)).toEqual({
        kind: 'unsupported',
        reason: left === '\u0100' ? 'character-domain' : 'string-limit',
      });
      expect(compare(left, '=', right).kind).toBe('unsupported');
    }
    expect(compare(full, '=', full)).toEqual(value(true));
  });
  test('rejects malformed types/operators without coercion and returns immutable independent outcomes', () => {
    const hostile = {
      toString() {
        throw Error('coerced');
      },
      valueOf() {
        throw Error('coerced');
      },
    };
    for (const invalid of [null, undefined, 1, true, Object('A'), hostile]) {
      expect(() => concat(invalid as string, '')).toThrow(TypeError);
      expect(() => concat('', invalid as string)).toThrow(TypeError);
      expect(() => compare(invalid as string, '=', 'A')).toThrow(TypeError);
      expect(() => compare('A', '=', invalid as string)).toThrow(TypeError);
    }
    expect(() => compare('A', '==' as ComparisonOperator, 'A')).toThrow(RangeError);
    for (const result of [
      concat('A', 'B'),
      concat('A', '\u0100'),
      compare('A', '<', 'B'),
      compare('a', '<', 'B'),
    ]) {
      expect(Object.isFrozen(result)).toBe(true);
      expect(() => Object.assign(result, {value: 'wrong'})).toThrow(TypeError);
    }
    expect(concat('X', 'Y')).toEqual(value('XY'));
    expect(concat('A', 'B')).toEqual(value('AB'));
  });
  test('keeps native Unicode concatenation, exact equality and private helper boundaries', () => {
    let output = '';
    new api.Basic({
      write: (text) => {
        output += text;
      },
    }).run('10 A$="🙂"+"é"\n20 PRINT A$\n30 IF "YES"="YES " THEN PRINT "wrong" ELSE PRINT "exact"');
    expect(output).toBe('🙂é\nexact\n');
    expect(() => api.parseProgram('10 IF "A"<"B" THEN 20\n20 END')).toThrow(api.BasicSyntaxError);
    expect('basicPlusStringConcat' in api).toBe(false);
    expect('compareBasicPlusStringRelation' in api).toBe(false);
    expect(api.parseProgram('10 PRINT "A"', {dialect: 'basic-plus-v4a12-ma2'}).dialect).toBe(
      'basic-plus-v4a12-ma2',
    );
  });
});
