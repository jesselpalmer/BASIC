import {describe, expect, it} from 'bun:test';
import {BasicSyntaxError, parseLine, parseProgram} from '../index.ts';
import type {SourceOptions} from '../index.ts';

function print(source: string, options?: SourceOptions) {
  const statement = parseLine(source, options)?.statement;
  if (statement?.type !== 'PrintStatement') throw new Error('Expected PRINT');
  return statement;
}

function diagnostic(source: string, complete = false) {
  try {
    if (complete) parseProgram(source);
    else parseLine(source);
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
  throw new Error('Expected invalid source');
}

describe('native PRINT item adjacency', () => {
  it.each([
    [
      '"score="N',
      [
        {type: 'StringLiteral', value: 'score='},
        {type: 'Variable', name: 'N'},
      ],
    ],
    [
      'N" points"',
      [
        {type: 'Variable', name: 'N'},
        {type: 'StringLiteral', value: ' points'},
      ],
    ],
    [
      '1 S$',
      [
        {type: 'NumberLiteral', value: 1},
        {type: 'Variable', name: 'S$'},
      ],
    ],
    [
      'S$ 1',
      [
        {type: 'Variable', name: 'S$'},
        {type: 'NumberLiteral', value: 1},
      ],
    ],
    [
      'S$ OTHER$',
      [
        {type: 'Variable', name: 'S$'},
        {type: 'Variable', name: 'OTHER$'},
      ],
    ],
    [
      '"a" "b"',
      [
        {type: 'StringLiteral', value: 'a'},
        {type: 'StringLiteral', value: 'b'},
      ],
    ],
    [
      '(S$+"=") (1+2)',
      [
        {type: 'GroupExpression', expression: {type: 'BinaryExpression', operator: '+'}},
        {type: 'GroupExpression', expression: {type: 'BinaryExpression', operator: '+'}},
      ],
    ],
    [
      'S$(1)N(2,3)',
      [
        {type: 'ArrayReference', name: 'S$'},
        {type: 'ArrayReference', name: 'N'},
      ],
    ],
    [
      'ABS(-2)INKEY$()INT(3.9)',
      [
        {type: 'CallExpression', name: 'ABS'},
        {type: 'CallExpression', name: 'INKEY$'},
        {type: 'CallExpression', name: 'INT'},
      ],
    ],
  ] as const)('accepts string-involved complete expressions: %s', (source, expected) => {
    const statement = print(`10 PRINT ${source}`);
    expect(statement.items).toHaveLength(expected.length);
    expect(statement.items).toMatchObject(expected);
    expect(statement.separators).toEqual([]);
    expect(statement.trailingSemicolon).toBe(false);
  });

  it('combines explicit and omitted separators and preserves trailing intent', () => {
    const statement = print('10 PRINT 1;2"x"3; -4 S$;');
    expect(statement.items).toMatchObject([
      {type: 'NumberLiteral', value: 1},
      {type: 'NumberLiteral', value: 2},
      {type: 'StringLiteral', value: 'x'},
      {type: 'NumberLiteral', value: 3},
      {type: 'UnaryExpression', operator: '-', argument: {type: 'NumberLiteral', value: 4}},
      {type: 'Variable', name: 'S$'},
    ]);
    expect(statement.separators.map(({start}) => start.column)).toEqual([11, 17, 24]);
    expect(statement.trailingSemicolon).toBe(true);
    expect(print('10 PRINT "x"N').trailingSemicolon).toBe(false);
    expect(print('10 PRINT').items).toEqual([]);
    expect(print('10 PRINT "";')).toMatchObject({
      items: [{type: 'StringLiteral', value: ''}],
      trailingSemicolon: true,
    });
  });

  it('preserves existing operator meaning, precedence, whitespace and string escapes', () => {
    for (const source of ['1-2', '1 -2', '1- 2', '1 - 2', '1\t-\t2']) {
      expect(print(`10 PRINT ${source}`).items).toMatchObject([
        {type: 'BinaryExpression', operator: '-', left: {value: 1}, right: {value: 2}},
      ]);
    }
    expect(print('10 PRINT "x" 1+2*3; -2*+3; "a"+S$+"b"').items).toMatchObject([
      {type: 'StringLiteral', value: 'x'},
      {type: 'BinaryExpression', operator: '+', right: {operator: '*'}},
      {type: 'BinaryExpression', operator: '*', left: {operator: '-'}, right: {operator: '+'}},
      {type: 'BinaryExpression', operator: '+', left: {operator: '+'}},
    ]);
    expect(print('10 PRINT "a""b"').items).toMatchObject([
      {type: 'StringLiteral', value: 'a"b', raw: '"a""b"'},
    ]);
    expect(print('10 PRINT SCORE;FORWARD;INTEGER;USING;DIM;GO;NAME$').items).toMatchObject([
      {name: 'SCORE'},
      {name: 'FORWARD'},
      {name: 'INTEGER'},
      {name: 'USING'},
      {name: 'DIM'},
      {name: 'GO'},
      {name: 'NAME$'},
    ]);
    for (const source of ['A(1)', 'A (1)', 'A\t(1)']) {
      expect(print(`10 PRINT ${source}`).items).toMatchObject([
        {type: 'ArrayReference', name: 'A', indices: [{type: 'NumberLiteral', value: 1}]},
      ]);
    }
  });

  it('keeps USING an ordinary scalar or array name', () => {
    expect(print('10 PRINT USING B$;J').items).toMatchObject([
      {type: 'Variable', name: 'USING'},
      {type: 'Variable', name: 'B$'},
      {type: 'Variable', name: 'J'},
    ]);
    expect(print('10 PRINT "x"USING(1,2)').items).toMatchObject([
      {type: 'StringLiteral'},
      {type: 'ArrayReference', name: 'USING', indices: [{value: 1}, {value: 2}]},
    ]);
    expect(parseLine('10 PRINT USING B$,J')?.statement.type).toBe('PrintUsingStatement');
  });

  it('retains physical UTF-16 spans, actual semicolons and exact fragment source', () => {
    const source = ' \t25 pRiNt "😀"N;\tS$(1) "z";  ';
    const line = parseLine(source, {line: 9, offset: 80})!;
    const statement = print(source, {line: 9, offset: 80});
    expect(line.source).toBe(source);
    expect(statement.location).toEqual({
      label: 25,
      start: {line: 9, column: 6, offset: 85},
      end: {line: 9, column: 29, offset: 108},
    });
    expect(statement.items.map(({location: {start, end}}) => [start.column, end.column])).toEqual([
      [12, 16],
      [16, 17],
      [19, 24],
      [25, 28],
    ]);
    expect(statement.items.map(({location: {start, end}}) => [start.offset, end.offset])).toEqual([
      [91, 95],
      [95, 96],
      [98, 103],
      [104, 107],
    ]);
    expect(statement.separators).toEqual([
      {label: 25, start: {line: 9, column: 17, offset: 96}, end: {line: 9, column: 18, offset: 97}},
      {
        label: 25,
        start: {line: 9, column: 28, offset: 107},
        end: {line: 9, column: 29, offset: 108},
      },
    ]);
    expect(Object.isFrozen(statement.items)).toBe(true);
    expect(Object.isFrozen(statement.separators)).toBe(true);
    const program = parseProgram('20 PRINT "x"N\r\n10 PRINT S$ 2;');
    expect(program.lines.map(({label}) => label)).toEqual([10, 20]);
    expect(program.lines[0].statement.location.start).toEqual({line: 2, column: 4, offset: 18});
    expect(program.lines[1].source).toBe('20 PRINT "x"N');
  });

  it.each([
    ['10 PRINT 1 2', 'UNEXPECTED_TOKEN', 12],
    ['10 PRINT N M', 'UNEXPECTED_TOKEN', 12],
    ['10 PRINT (1)(2)', 'UNEXPECTED_TOKEN', 13],
    ['10 PRINT "x" (1)(2)', 'UNEXPECTED_TOKEN', 17],
    ['10 PRINT "x" N M', 'UNEXPECTED_TOKEN', 16],
    ['10 PRINT ("x"+1) N', 'UNEXPECTED_TOKEN', 18],
    ['10 PRINT 1 ("x"+1)', 'UNEXPECTED_TOKEN', 12],
    ['10 PRINT USING J', 'UNEXPECTED_TOKEN', 16],
    ['10 PRINT ;', 'EXPECTED_EXPRESSION', 10],
    ['10 PRINT "x";;N', 'EXPECTED_EXPRESSION', 14],
    ['10 PRINT "x" N,2', 'UNEXPECTED_TOKEN', 15],
    ['10 PRINT "x" N=2', 'UNEXPECTED_TOKEN', 15],
    ['10 PRINT "x" N<2', 'UNEXPECTED_TOKEN', 15],
    ['10 PRINT "x" N+', 'EXPECTED_EXPRESSION', 16],
    ['10 PRINT "x" *', 'EXPECTED_EXPRESSION', 15],
    ['10 PRINT "x" ABS', 'EXPECTED_TOKEN', 17],
    ['10 PRINT "x" ABS(1 2)', 'EXPECTED_TOKEN', 20],
    ['10 PRINT "x" A(1 2)', 'EXPECTED_TOKEN', 18],
    ['10 PRINT "x" (1 2)', 'EXPECTED_TOKEN', 17],
    ['10 PRINT "x" A(1,)', 'EXPECTED_EXPRESSION', 18],
    ['10 PRINT "x" 12oops', 'INVALID_NUMBER', 14],
    ['10 LET A = "x" N', 'UNEXPECTED_TOKEN', 16],
    ['10 WAIT "x" N', 'UNEXPECTED_TOKEN', 13],
  ] as const)('rejects unsupported boundaries or malformed syntax: %s', (source, code, column) => {
    expect(diagnostic(source)).toMatchObject({
      code,
      label: 10,
      line: 1,
      column,
      offset: column - 1,
    });
  });

  it('keeps array declaration and rank checks across every adjacent item', () => {
    const program = parseProgram('10 PRINT "x"A(1,2) S$(0)\n20 DIM A(1,2),S$(0)');
    expect(program.lines).toHaveLength(2);
    expect(diagnostic('10 END\n20 PRINT "x"A(0)', true)).toMatchObject({
      code: 'UNDECLARED_ARRAY',
      label: 20,
      line: 2,
      column: 13,
    });
    expect(diagnostic('10 DIM A(1)\n20 PRINT "x"A(0,0)', true)).toMatchObject({
      code: 'ARRAY_RANK_MISMATCH',
      label: 20,
      line: 2,
      column: 13,
    });
  });

  it('infers long flat string expressions without recursive parser type traversal', () => {
    const statement = print(`10 PRINT ${Array(3000).fill('"x"').join('+')} 1`);
    expect(statement.items).toHaveLength(2);
    expect(statement.items[1]).toMatchObject({type: 'NumberLiteral', value: 1});
  });
});
