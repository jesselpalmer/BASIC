import type {SourceOptions} from '../core/types.ts';
import {describe, it, expect} from 'bun:test';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {tokenize} from './tokenizer.ts';

const values = (source: string, options: SourceOptions & {numbered?: boolean} = {}) =>
  tokenize(source, options).map(({type, value}) => [type, value]);

function diagnostic(source: string, options: SourceOptions & {numbered?: boolean} = {}) {
  try {
    tokenize(source, options);
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
  throw new Error('Expected a syntax error');
}

describe('tokenizer', () => {
  it('normalizes names while preserving text and exact source spans', () => {
    const source = '\t010\tlet Name$ = "MiX  ""Hi""\\n"';
    const tokens = tokenize(source);
    expect(tokens.map(({type, value}) => [type, value])).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'LET'],
      ['IDENTIFIER', 'NAME$'],
      ['OPERATOR', '='],
      ['STRING', 'MiX  "Hi"\\n'],
      ['EOF', null],
    ]);
    expect(tokens[0]).toMatchObject({
      raw: '010',
      label: 10,
      start: {line: 1, column: 2, offset: 1},
      end: {line: 1, column: 5, offset: 4},
    });
    expect(tokens[2].raw).toBe('Name$');
    expect(tokens[4].start).toEqual({line: 1, column: 18, offset: 17});
    for (const token of tokens) {
      const raw = source.slice(token.start.offset, token.end.offset);
      expect(raw).toBe(token.raw);
    }
  });

  it.each(['1', '65535', '00010'])('accepts the complete line label %s', (label) => {
    expect(tokenize(`${label}\tEND`)[0].value).toBe(Number(label));
  });

  it.each([
    '10abc',
    '1.5',
    '-10',
    '+10',
    '0',
    '000',
    '65536',
    '1e2',
    '0x10',
    '10PRINT',
    '10"x"',
    '10:PRINT',
    '.5',
    'oops',
    '9'.repeat(400),
  ])('rejects the complete invalid label %s', (label) => {
    expect(diagnostic(`  ${label} PRINT "x"`)).toMatchObject({
      code: 'INVALID_LABEL',
      label: null,
      line: 1,
      column: 3,
      offset: 2,
    });
  });

  it('distinguishes line labels from later numbers', () => {
    expect(values('0010 GOTO 20')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'GOTO'],
      ['NUMBER', 20],
      ['EOF', null],
    ]);
    expect(values('10')).toEqual([
      ['LABEL', 10],
      ['EOF', null],
    ]);
  });

  it('recognizes operators, punctuation, and unsigned numbers', () => {
    expect(values('10 PRINT -ABS(.5)+INT(1.)*2/3;(4),5')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'PRINT'],
      ['OPERATOR', '-'],
      ['KEYWORD', 'ABS'],
      ['PUNCTUATION', '('],
      ['NUMBER', 0.5],
      ['PUNCTUATION', ')'],
      ['OPERATOR', '+'],
      ['KEYWORD', 'INT'],
      ['PUNCTUATION', '('],
      ['NUMBER', 1],
      ['PUNCTUATION', ')'],
      ['OPERATOR', '*'],
      ['NUMBER', 2],
      ['OPERATOR', '/'],
      ['NUMBER', 3],
      ['PUNCTUATION', ';'],
      ['PUNCTUATION', '('],
      ['NUMBER', 4],
      ['PUNCTUATION', ')'],
      ['PUNCTUATION', ','],
      ['NUMBER', 5],
      ['EOF', null],
    ]);
  });

  it.each(['=', '<>', '<', '<=', '>', '>='])(
    'recognizes comparison %s as one token',
    (operator) => {
      const tokens = tokenize(`10 IF A${operator}2 THEN 30`);
      expect(tokens[3]).toMatchObject({type: 'OPERATOR', value: operator});
      expect(tokens[4]).toMatchObject({type: 'NUMBER', value: 2});
    },
  );

  it.each(['0', '42', '003.50', '.5', '1.'])('consumes decimal %s completely', (raw) => {
    expect(tokenize(`10 PRINT ${raw}`)[2]).toMatchObject({
      type: 'NUMBER',
      raw,
      value: Number(raw),
    });
  });

  it.each(['12oops', '1e', '1e+', '0x10', '0b10', '1.2.3', '..5', '.', '12$', '9'.repeat(400)])(
    'rejects malformed or non-finite decimal %s',
    (literal) => {
      expect(diagnostic(`10 PRINT ${literal}`)).toMatchObject({
        code: 'INVALID_NUMBER',
        label: 10,
        line: 1,
        column: 10,
        offset: 9,
      });
    },
  );

  it('keeps identifier boundaries distinct from keywords and literals', () => {
    expect(values('10 LET Print2$=Remark$+Nan+Infinity')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'LET'],
      ['IDENTIFIER', 'PRINT2$'],
      ['OPERATOR', '='],
      ['IDENTIFIER', 'REMARK$'],
      ['OPERATOR', '+'],
      ['IDENTIFIER', 'NAN'],
      ['OPERATOR', '+'],
      ['IDENTIFIER', 'INFINITY'],
      ['EOF', null],
    ]);
  });

  it.each([
    ['""', ''],
    ['""""', '"'],
    ['"a""b"', 'a"b'],
    ['" C:\\Tmp\\n\t🙂 "', ' C:\\Tmp\\n\t🙂 '],
    ['"PRINT: REM <> ;"', 'PRINT: REM <> ;'],
  ])('decodes only doubled quotes in %s', (raw, value) => {
    expect(tokenize(`10 PRINT ${raw}`)[2]).toMatchObject({
      type: 'STRING',
      value,
      raw,
    });
  });

  it.each(['"unfinished', '"""', '"unfinished\n20 END', '"bad\r\n20 END'])(
    'locates the unterminated string %s',
    (text) => {
      expect(diagnostic(`\n  20 PRINT ${text}`)).toMatchObject({
        code: 'UNTERMINATED_STRING',
        label: 20,
        line: 2,
        column: 12,
        offset: 12,
      });
    },
  );

  it.each(['', ' "unfinished <> + : \' \\ @', '\tPRINT "x";2🙂'])(
    'leaves the complete REM tail uninterpreted: %s',
    (comment) => {
      expect(values(`10 rEm${comment}\r\n20 END`)).toEqual([
        ['LABEL', 10],
        ['KEYWORD', 'REM'],
        ['COMMENT', comment],
        ['NEWLINE', null],
        ['LABEL', 20],
        ['KEYWORD', 'END'],
        ['EOF', null],
      ]);
    },
  );

  it.each([':', "'", '@', '_', '$', '\u00a0', '\r', '\v', '🙂'])(
    'locates unsupported character %s',
    (character) => {
      expect(diagnostic(`10 PRINT "x" ${character}`)).toMatchObject({
        code: 'UNEXPECTED_CHARACTER',
        label: 10,
        line: 1,
        column: 14,
        offset: 13,
      });
    },
  );

  it('preserves offsets across blank lines and LF/CRLF boundaries', () => {
    const source = '\r\n\t10 END\r\n \n20 REM hi';
    const tokens = tokenize(source);
    expect(tokens.filter(({type}) => type === 'LABEL')).toMatchObject([
      {value: 10, start: {line: 2, column: 2, offset: 3}},
      {value: 20, start: {line: 4, column: 1, offset: 13}},
    ]);
    expect(tokens.filter(({type}) => type === 'NEWLINE')).toMatchObject([
      {raw: '\r\n', end: {line: 2, column: 1, offset: 2}},
      {raw: '\r\n', end: {line: 3, column: 1, offset: 11}},
      {raw: '\n', end: {line: 4, column: 1, offset: 13}},
    ]);
    expect(tokens.at(-1)).toMatchObject({
      type: 'EOF',
      start: {line: 4, column: 10, offset: 22},
    });
    expect(diagnostic('\r\n\t10abc END')).toMatchObject({
      label: null,
      line: 2,
      column: 2,
      offset: 3,
    });
  });

  it('allows hosts to retain physical positions when scanning one line', () => {
    expect(tokenize('10 PRINT "x"', {line: 4, offset: 30})[2]).toMatchObject({
      start: {line: 4, column: 10, offset: 39},
      end: {line: 4, column: 13, offset: 42},
    });
  });

  it('can tokenize future unnumbered session commands without executing them', () => {
    expect(values('load "MiXeD Path.bas"', {numbered: false})).toEqual([
      ['KEYWORD', 'LOAD'],
      ['STRING', 'MiXeD Path.bas'],
      ['EOF', null],
    ]);
  });

  it('has no shared state across successful or failed calls', () => {
    const source = '10 PRINT "ok"';
    const first = tokenize(source);
    diagnostic('10 PRINT "bad');
    expect(tokenize(source)).toEqual(first);
    expect(values('')).toEqual([['EOF', null]]);
  });
});
