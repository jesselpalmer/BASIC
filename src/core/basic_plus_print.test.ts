import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseLine} from '../index.ts';
import {
  BASIC_PLUS_PRINT_OPERATION_LIMIT,
  BASIC_PLUS_PRINT_OUTPUT_LIMIT,
  basicPlusPrintLayout as layout,
  type BasicPlusPrintOperation,
} from './basic_plus_print.ts';

const integer = (value: number): BasicPlusPrintOperation => ({kind: 'integer', value});
const text = (value: string): BasicPlusPrintOperation => ({kind: 'text', value});
const comma = Object.freeze({kind: 'comma'} as const);
const semicolon = Object.freeze({kind: 'semicolon'} as const);

describe('internal BASIC-PLUS PRINT layout', () => {
  it('matches the manual five-zone integer example and sixth-entry line change', () => {
    expect(
      layout([
        integer(3),
        comma,
        integer(2),
        comma,
        integer(5),
        comma,
        integer(6),
        comma,
        integer(1),
        comma,
        integer(-1),
      ]),
    ).toEqual({
      kind: 'value',
      text:
        ' 3            ' + ' 2            ' + ' 5            ' + ' 6            ' + ' 1 \n-1 \n',
      column: 0,
    });
  });

  it('matches the manual skipped-zone example', () => {
    expect(layout([integer(1), comma, integer(2), comma, comma, integer(3)])).toEqual({
      kind: 'value',
      text: ' 1            ' + ' 2            ' + '              ' + ' 3 \n',
      column: 0,
    });
  });

  it('packs semicolon-separated values and preserves sign positions and endpoint text', () => {
    expect(layout([integer(1), semicolon, integer(2), semicolon, integer(3), semicolon])).toEqual({
      kind: 'value',
      text: ' 1  2  3 ',
      column: 9,
    });
    expect(layout([integer(0), integer(-0), integer(-1), integer(32767), integer(-32768)])).toEqual(
      {kind: 'value', text: ' 0  0 -1  32767 -32768 \n', column: 0},
    );
    expect(layout([text('SCORE='), integer(4)])).toEqual({
      kind: 'value',
      text: 'SCORE= 4 \n',
      column: 0,
    });
  });

  it('preserves unpadded printable text, including exact blanks and empty values', () => {
    expect(layout([text(' A '), semicolon, text('B'), text(''), semicolon])).toEqual({
      kind: 'value',
      text: ' A B',
      column: 4,
    });
    expect(layout([])).toEqual({kind: 'value', text: '\n', column: 0});
    expect(layout([text('')], 21)).toEqual({kind: 'value', text: '\n', column: 0});
    expect(layout([semicolon], 21)).toEqual({kind: 'value', text: '', column: 21});
    expect(layout([], 72)).toEqual({kind: 'value', text: '\n', column: 0});
  });

  it('carries trailing separator cursors into subsequent calls', () => {
    const first = layout([integer(1), comma]);
    expect(first).toEqual({kind: 'value', text: ' 1            ', column: 14});
    if (first.kind !== 'value') throw Error('Expected completed output');
    const second = layout([integer(2)], first.column);
    expect(second).toEqual({kind: 'value', text: ' 2 \n', column: 0});
    expect(layout([integer(1), semicolon])).toEqual({kind: 'value', text: ' 1 ', column: 3});
    expect(layout([integer(2)], 3)).toEqual({kind: 'value', text: ' 2 \n', column: 0});
  });

  it.each([
    [0, 14, 14],
    [1, 14, 13],
    [13, 14, 1],
    [14, 28, 14],
    [27, 28, 1],
    [28, 42, 14],
    [41, 42, 1],
    [42, 56, 14],
    [55, 56, 1],
  ])('advances comma from cursor %s to %s with %s blanks', (column, next, spaces) => {
    expect(layout([comma], column)).toEqual({
      kind: 'value',
      text: ' '.repeat(spaces),
      column: next,
    });
  });

  it.each([56, 57, 69, 70, 71, 72])(
    'moves the comma after the fifth zone to a new line from %s',
    (column) => {
      expect(layout([comma], column)).toEqual({kind: 'value', text: '\n', column: 0});
    },
  );

  it('requires an entire item to fit while accepting the exact margin', () => {
    expect(layout([text('X'.repeat(72)), semicolon])).toEqual({
      kind: 'value',
      text: 'X'.repeat(72),
      column: 72,
    });
    expect(layout([integer(1), semicolon], 69)).toEqual({kind: 'value', text: ' 1 ', column: 72});
    expect(layout([text('X'.repeat(73))])).toEqual({kind: 'unsupported', reason: 'line-width'});
    expect(layout([text('A')], 72)).toEqual({kind: 'unsupported', reason: 'line-width'});
    expect(layout([integer(1)], 70)).toEqual({kind: 'unsupported', reason: 'line-width'});
    expect(layout([text('before'), text('X'.repeat(72))])).toEqual({
      kind: 'unsupported',
      reason: 'line-width',
    });
  });

  it.each([-32769, 32768, 0.5, NaN, Infinity, -Infinity])(
    'rejects unsettled integer output %s atomically',
    (value) => {
      expect(layout([text('before'), integer(value)])).toEqual({
        kind: 'unsupported',
        reason: 'integer-domain',
      });
    },
  );

  it.each(['\n', '\r', '\t', '\0', '\x7f', '\u0080', '\u00ff', '🙂', '\ud800'])(
    'rejects unimplemented terminal character %s atomically',
    (value) => {
      expect(layout([text('before'), text(value)])).toEqual({
        kind: 'unsupported',
        reason: 'text-domain',
      });
    },
  );

  it('accepts the full printable ASCII domain without terminal interpretation', () => {
    const first = Array.from({length: 48}, (_, index) => String.fromCharCode(32 + index)).join('');
    const second = Array.from({length: 47}, (_, index) => String.fromCharCode(80 + index)).join('');
    expect(layout([text(first)])).toEqual({kind: 'value', text: first + '\n', column: 0});
    expect(layout([text(second)])).toEqual({kind: 'value', text: second + '\n', column: 0});
  });

  it('enforces operation limits before visiting over-limit payloads', () => {
    expect(layout(Array.from({length: BASIC_PLUS_PRINT_OPERATION_LIMIT}, () => semicolon))).toEqual(
      {kind: 'value', text: '', column: 0},
    );
    expect(
      layout(Array.from({length: BASIC_PLUS_PRINT_OPERATION_LIMIT + 1}, () => semicolon)),
    ).toEqual({kind: 'unsupported', reason: 'operation-limit'});
  });

  it('bounds numeric traversal independently of overridden iterators and input growth', () => {
    const operations = [text('A')];
    operations[Symbol.iterator] = function* () {
      yield text('wrong');
      throw new Error('Iterator must not execute');
    };
    expect(layout(operations)).toEqual({kind: 'value', text: 'A\n', column: 0});
    const growing: BasicPlusPrintOperation[] = [];
    Object.defineProperty(growing, 0, {
      get() {
        growing.push(semicolon);
        return text('B');
      },
    });
    expect(layout(growing)).toEqual({kind: 'value', text: 'B\n', column: 0});
    expect(growing).toHaveLength(2);
  });

  it('uses one validated snapshot of each mutable operation payload', () => {
    let textReads = 0,
      integerReads = 0;
    const first = {
      kind: 'text' as const,
      get value() {
        textReads++;
        return textReads === 1 ? 'ok' : 'bad';
      },
    };
    const second = {
      kind: 'integer' as const,
      get value() {
        integerReads++;
        return integerReads === 1 ? 2 : NaN;
      },
    };
    expect(layout([first, second, semicolon])).toEqual({kind: 'value', text: 'ok 2 ', column: 5});
    expect(textReads).toBe(1);
    expect(integerReads).toBe(1);
  });

  it('bounds full output including comma newlines without returning a partial result', () => {
    const lines: BasicPlusPrintOperation[] = [];
    for (let count = 0; count < 897; count++) lines.push(text('X'.repeat(72)), comma);
    const exact = layout([...lines, text('X'.repeat(55)), semicolon]);
    expect(exact.kind).toBe('value');
    if (exact.kind !== 'value') throw Error('Expected bounded completed text');
    expect(exact.text.length).toBe(BASIC_PLUS_PRINT_OUTPUT_LIMIT);
    expect(exact.column).toBe(55);
    expect(layout([...lines, text('X'.repeat(56)), semicolon])).toEqual({
      kind: 'unsupported',
      reason: 'output-limit',
    });
    expect(layout([...lines, text('X'.repeat(55))])).toEqual({
      kind: 'unsupported',
      reason: 'output-limit',
    });
    expect(layout([...lines, text('X'.repeat(55)), comma])).toEqual({
      kind: 'unsupported',
      reason: 'output-limit',
    });
  });

  it.each([-1, 73, 0.5, NaN, Infinity, '0', null])('rejects malformed cursor %s', (column) => {
    expect(() => {
      Reflect.apply(layout, null, [[], column]);
    }).toThrow(RangeError);
  });

  it('rejects malformed operation types and values without coercion', () => {
    for (const operations of [
      null,
      {},
      1,
      'text',
      [null],
      [1],
      [{kind: 'tab', value: 5}],
      [{kind: 'text', value: 3}],
      [{kind: 'integer', value: '1'}],
    ])
      expect(() => {
        Reflect.apply(layout, null, [operations]);
      }).toThrow(TypeError);
  });

  it('returns frozen independent outcomes without changing or freezing caller operations', () => {
    const item = {kind: 'text' as const, value: 'A'};
    const operations = [item, semicolon];
    const result = layout(operations);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(layout([integer(0.5)]))).toBe(true);
    expect(Object.isFrozen(item)).toBe(false);
    expect(Object.isFrozen(operations)).toBe(false);
    item.value = 'B';
    operations.length = 0;
    expect(result).toEqual({kind: 'value', text: 'A', column: 1});
    expect(layout([text('C')])).toEqual({kind: 'value', text: 'C\n', column: 0});
  });

  it('preserves public native PRINT grammar, spelling and future names', () => {
    const output: string[] = [];
    new Basic({write: (message) => output.push(message)}).run(
      '10 DIM TAB(0):TAB(0)=3:TAB=4:PRINT 1;-1;0;TAB;TAB(0)',
    );
    expect(output).toEqual(['1-1043\n']);
    expect(() => parseLine('10 PRINT 1,2')).toThrow(BasicSyntaxError);
    const statement = parseLine('10 PRINT TAB(0)')?.statement;
    if (statement?.type !== 'PrintStatement') throw Error('Expected PRINT');
    expect(statement.items[0].type).toBe('ArrayReference');
  });
});
