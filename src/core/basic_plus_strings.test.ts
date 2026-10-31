import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseLine} from '../index.ts';
import {
  BASIC_PLUS_STRING_LIMIT,
  basicPlusStringLength as length,
  basicPlusStringLeft as left,
  basicPlusStringRight as right,
  basicPlusStringMid as mid,
  basicPlusStringAscii as ascii,
  basicPlusStringCharacter as character,
  basicPlusStringSpace as space,
  basicPlusStringSearch as search,
} from './basic_plus_strings.ts';

describe('internal BASIC-PLUS string conformance', () => {
  it('matches the independently printed table 5-3 examples', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    expect(left(alphabet, 7)).toEqual({kind: 'value', value: 'ABCDEFG'});
    expect(right(alphabet, 20)).toEqual({kind: 'value', value: 'TUVWXYZ'});
    expect(mid(alphabet, 15, 5)).toEqual({kind: 'value', value: 'OPQRS'});
    expect(length(alphabet)).toEqual({kind: 'value', value: 26});
    expect(ascii('XAB')).toEqual({kind: 'value', value: 88});
    expect(character(65)).toEqual({kind: 'value', value: 'A'});
    expect(search(5, alphabet, 'OP')).toEqual({kind: 'value', value: 15});
  });

  it('counts bytes including blanks, nulls and high-bit characters', () => {
    expect(length('')).toEqual({kind: 'value', value: 0});
    expect(length('A \0\u0080\u00ff ')).toEqual({kind: 'value', value: 6});
    expect(ascii('\0suffix')).toEqual({kind: 'value', value: 0});
    expect(ascii('\u00ff')).toEqual({kind: 'value', value: 255});
    expect(character(193)).toEqual({kind: 'value', value: '\u00c1'});
    expect(character(65)).not.toEqual(character(193));
  });

  it('maps every character code independently in both directions', () => {
    for (let code = 0; code < 256; code++) {
      const encoded = character(code);
      expect(encoded.kind).toBe('value');
      if (encoded.kind !== 'value') throw Error('Expected a character');
      expect(encoded.value.length).toBe(1);
      expect(encoded.value.codePointAt(0)).toBe(code);
      expect(ascii(encoded.value + 'tail')).toEqual({kind: 'value', value: code});
    }
  });

  it('selects every in-bounds short substring with independent expected text', () => {
    const source = 'ABC';
    expect(left(source, 1)).toEqual({kind: 'value', value: 'A'});
    expect(left(source, 2)).toEqual({kind: 'value', value: 'AB'});
    expect(left(source, 3)).toEqual({kind: 'value', value: 'ABC'});
    expect(right(source, 1)).toEqual({kind: 'value', value: 'ABC'});
    expect(right(source, 2)).toEqual({kind: 'value', value: 'BC'});
    expect(right(source, 3)).toEqual({kind: 'value', value: 'C'});
    for (const [start, count, expected] of [
      [1, 1, 'A'],
      [1, 2, 'AB'],
      [1, 3, 'ABC'],
      [2, 1, 'B'],
      [2, 2, 'BC'],
      [3, 1, 'C'],
    ] as const)
      expect(mid(source, start, count)).toEqual({kind: 'value', value: expected});
    expect(mid('\0A\u00ff ', 2, 3)).toEqual({kind: 'value', value: 'A\u00ff '});
  });

  it.each([0, -1, 0.5, 1.5, 4, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER])(
    'keeps ambiguous or invalid substring index %s unsupported',
    (index) => {
      expect(left('ABC', index)).toEqual({kind: 'unsupported', reason: 'index-domain'});
      expect(right('ABC', index)).toEqual({kind: 'unsupported', reason: 'index-domain'});
      expect(mid('ABC', index, 1)).toEqual({kind: 'unsupported', reason: 'index-domain'});
      expect(mid('ABC', 1, index)).toEqual({kind: 'unsupported', reason: 'index-domain'});
    },
  );

  it('does not silently clamp substring ranges or apply empty-string shortcuts', () => {
    expect(mid('ABC', 3, 2)).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(left('', 1)).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(right('', 1)).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(mid('', 1, 1)).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(ascii('')).toEqual({kind: 'unsupported', reason: 'empty-ascii'});
  });

  it('searches from one-based positions with exact blanks, case and high bits', () => {
    expect(search(1, 'BANANA', 'ANA')).toEqual({kind: 'value', value: 2});
    expect(search(3, 'BANANA', 'ANA')).toEqual({kind: 'value', value: 4});
    expect(search(5, 'BANANA', 'ANA')).toEqual({kind: 'value', value: 0});
    expect(search(1, 'BANANA', 'ana')).toEqual({kind: 'value', value: 0});
    expect(search(1, 'A ', 'A  ')).toEqual({kind: 'value', value: 0});
    expect(search(1, 'A ', ' ')).toEqual({kind: 'value', value: 2});
    expect(search(1, '\0\u00c1A', 'A')).toEqual({kind: 'value', value: 3});
    expect(search(1, 'ABC', '')).toEqual({kind: 'unsupported', reason: 'empty-pattern'});
    expect(search(1, '', 'A')).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(search(4, 'ABC', 'A')).toEqual({kind: 'unsupported', reason: 'index-domain'});
    expect(search(0, 'ABC', 'A')).toEqual({kind: 'unsupported', reason: 'index-domain'});
  });

  it('bounds allocations and validates complete input even after an early match', () => {
    const maximum = ' '.repeat(BASIC_PLUS_STRING_LIMIT);
    expect(length(maximum)).toEqual({kind: 'value', value: 32767});
    expect(space(0)).toEqual({kind: 'value', value: ''});
    expect(space(3)).toEqual({kind: 'value', value: '   '});
    expect(space(32767)).toEqual({kind: 'value', value: maximum});
    expect(right(maximum, 32767)).toEqual({kind: 'value', value: ' '});
    expect(mid(maximum, 32767, 1)).toEqual({kind: 'value', value: ' '});
    const over = maximum + ' ';
    for (const result of [
      length(over),
      left(over, 1),
      right(over, 1),
      mid(over, 1, 1),
      ascii(over),
      search(1, over, ' '),
      search(1, ' ', over),
      space(32768),
    ])
      expect(result).toEqual({kind: 'unsupported', reason: 'string-limit'});
    for (const invalid of ['A🙂', 'A\ud800', 'A\u0100'])
      for (const result of [
        length(invalid),
        left(invalid, 1),
        right(invalid, 1),
        mid(invalid, 1, 1),
        ascii(invalid),
        search(1, invalid, 'A'),
        search(1, 'A', invalid),
      ])
        expect(result).toEqual({kind: 'unsupported', reason: 'character-domain'});
    expect(search(1, over, '\u0100')).toEqual({kind: 'unsupported', reason: 'string-limit'});
  });

  it.each([-1, 0.5, 256, NaN, Infinity, -Infinity])(
    'rejects unsupported character code %s',
    (code) => {
      expect(character(code)).toEqual({kind: 'unsupported', reason: 'character-domain'});
    },
  );

  it.each([-1, 0.5, NaN, -Infinity])('rejects invalid space count %s', (count) => {
    expect(space(count)).toEqual({kind: 'unsupported', reason: 'index-domain'});
  });

  it('rejects malformed argument types without coercion', () => {
    const cases: readonly [(...args: never[]) => unknown, unknown[]][] = [
      [length, [1]],
      [left, [1, 1]],
      [right, [null, 1]],
      [mid, [{}, 1, 1]],
      [ascii, [undefined]],
      [left, ['A', '1']],
      [right, ['A', true]],
      [mid, ['A', 1, '1']],
      [space, ['1']],
      [character, ['65']],
      [search, ['1', 'A', 'A']],
      [search, [1, 1, 'A']],
      [search, [1, 'A', 1]],
    ];
    for (const [action, args] of cases)
      expect(() => {
        Reflect.apply(action, null, args);
      }).toThrow(TypeError);
  });

  it('returns immutable independent outcomes', () => {
    const good = left('ABC', 2),
      bad = right('ABC', 0);
    expect(Object.isFrozen(good)).toBe(true);
    expect(Object.isFrozen(bad)).toBe(true);
    expect(() => Object.assign(good, {value: 'changed'})).toThrow(TypeError);
    expect(left('XYZ', 2)).toEqual({kind: 'value', value: 'XY'});
    expect(left('ABC', 2)).toEqual(good);
  });

  it('preserves native scalar/array names and exact string comparison behavior', () => {
    const names = [
      'LEN',
      'LEFT',
      'RIGHT',
      'MID',
      'ASCII',
      'CHR$',
      'SPACE$',
      'INSTR',
      'VAL',
      'NUM$',
    ];
    for (const name of names) {
      const statement = parseLine(`10 PRINT ${name}(0)`)?.statement;
      if (statement?.type !== 'PrintStatement') throw Error('Expected PRINT');
      expect(statement.items[0].type).toBe('ArrayReference');
      const value = name.endsWith('$') ? '"ok"' : '7';
      const output: string[] = [];
      const basic = new Basic({write: (text) => output.push(text)});
      basic.run(`10 DIM ${name}(0):${name}=${value}:${name}(0)=${value}:PRINT ${name};${name}(0)`);
      expect(output).toEqual([name.endsWith('$') ? 'okok\n' : '77\n']);
    }
    const basic = new Basic();
    expect(() => basic.run('10 PRINT LEFT("ABC",1)')).toThrow(BasicSyntaxError);
    expect(() => basic.run('10 PRINT ASCII(0)')).toThrow(BasicSyntaxError);
    const output: string[] = [];
    new Basic({write: (text) => output.push(text)}).run(
      '10 IF "YES"="YES " THEN PRINT "wrong" ELSE PRINT "exact"',
    );
    expect(output).toEqual(['exact\n']);
  });
});
