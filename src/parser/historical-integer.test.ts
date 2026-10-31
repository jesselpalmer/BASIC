import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseLine, parseProgram} from '../index.ts';
import {historicalNumericSpelling} from './historical_numeric.ts';
import {tokenize} from './tokenizer.ts';

const policy = 'basic-plus-1972-10' as const;
const scan = (source: string) => tokenize(source, {lexicalPolicy: policy});

describe('internal historical integer spellings', () => {
  it('retains distinct immutable lexical kinds despite equal decoded values', () => {
    for (const [raw, kind] of [
      ['4%', 'integer'],
      ['4', 'whole'],
      ['4.', 'floating'],
      ['4E0', 'floating'],
    ] as const) {
      const descriptor = historicalNumericSpelling(raw);
      expect(descriptor).toEqual({raw, kind, value: 4});
      expect(Object.isFrozen(descriptor)).toBe(true);
    }
    expect(historicalNumericSpelling('000%')).toEqual({raw: '000%', kind: 'integer', value: 0});
    expect(historicalNumericSpelling('32767%').value).toBe(32767);
    expect(historicalNumericSpelling('.5E-2').value).toBe(0.005);
  });

  it.each([
    '',
    '%',
    '-1%',
    '+1%',
    '1.%',
    '1.5%',
    '1E0%',
    '1e2',
    '1%%',
    '1%$',
    'Infinity',
    '1E999',
    '12oops',
  ])('rejects malformed descriptor %s', (raw) => {
    expect(() => historicalNumericSpelling(raw)).toThrow(SyntaxError);
  });

  it('rejects unsupported magnitude and malformed caller types without coercion', () => {
    for (const raw of ['32768%', '65535%', '9'.repeat(400) + '%'])
      expect(() => historicalNumericSpelling(raw)).toThrow(RangeError);
    expect(() => {
      Reflect.apply(historicalNumericSpelling, null, [1]);
    }).toThrow(TypeError);
  });

  it('retains integer scalar/array names, literal suffixes and separate signs', () => {
    expect(
      scan('10A1%=-2%:DIMA%(2%):READA%(1%):PRINTA1%;A%').map(({type, value}) => [type, value]),
    ).toEqual([
      ['LABEL', 10],
      ['IDENTIFIER', 'A1%'],
      ['OPERATOR', '='],
      ['OPERATOR', '-'],
      ['NUMBER', 2],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'DIM'],
      ['IDENTIFIER', 'A%'],
      ['PUNCTUATION', '('],
      ['NUMBER', 2],
      ['PUNCTUATION', ')'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'READ'],
      ['IDENTIFIER', 'A%'],
      ['PUNCTUATION', '('],
      ['NUMBER', 1],
      ['PUNCTUATION', ')'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'PRINT'],
      ['IDENTIFIER', 'A1%'],
      ['PUNCTUATION', ';'],
      ['IDENTIFIER', 'A%'],
      ['EOF', null],
    ]);
  });

  it('preserves compact clause boundaries, strings and comments', () => {
    const source =
      '10FORI%=1%TO3%STEP1%:NEXTI%\r\n20IFI%=3%THENPRINT"100%"ELSEPRINT0%:REM 1.5% A%%';
    const tokens = scan(source);
    expect(tokens.filter(({type}) => type === 'KEYWORD').map(({value}) => value)).toEqual([
      'FOR',
      'TO',
      'STEP',
      'NEXT',
      'IF',
      'THEN',
      'PRINT',
      'ELSE',
      'PRINT',
      'REM',
    ]);
    expect(tokens.find(({type}) => type === 'STRING')?.value).toBe('100%');
    expect(tokens.find(({type}) => type === 'COMMENT')?.value).toBe(' 1.5% A%%');
    for (const token of tokens)
      expect(source.slice(token.start.offset, token.end.offset)).toBe(token.raw);
  });

  it('locates suffixes with fragment offsets, tabs and CRLF', () => {
    const source = '\t10A%=01%\r\n20PRINTA%';
    const tokens = tokenize(source, {lexicalPolicy: policy, offset: 50, line: 7});
    expect(tokens[1]).toMatchObject({
      raw: 'A%',
      value: 'A%',
      start: {line: 7, column: 4, offset: 53},
      end: {line: 7, column: 6, offset: 55},
    });
    expect(tokens.find(({raw}) => raw === '01%')).toMatchObject({
      value: 1,
      start: {line: 7, column: 7, offset: 56},
      end: {line: 7, column: 10, offset: 59},
    });
    for (const token of tokens)
      expect(source.slice(token.start.offset - 50, token.end.offset - 50)).toBe(token.raw);
  });

  it.each(['1.%', '1.5%', '1E0%', '1%%', '1%$', '1%2', '1%.0', '1%A', '1%TO2'])(
    'rejects malformed or misplaced literal suffix %s',
    (raw) => {
      expect(() => scan('10PRINT' + raw)).toThrow(BasicSyntaxError);
    },
  );

  it.each(['A%%', 'A%$', 'A$%', 'A12%', 'A%1', 'ABS%', 'PI%', 'LOG10%'])(
    'rejects malformed names and unimplemented function suffix %s',
    (name) => {
      expect(() => scan('10PRINT' + name)).toThrow(BasicSyntaxError);
    },
  );

  it('reports explicitly unsupported range at the operand location', () => {
    for (const raw of ['32768%', '-32768%', '65536%']) {
      try {
        scan('10PRINT' + raw);
        throw new Error('Expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicSyntaxError);
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic).toMatchObject({
          code: 'UNSUPPORTED_LEXICAL_FORM',
          label: 10,
          column: raw.startsWith('-') ? 9 : 8,
        });
      }
    }
  });

  it('keeps suffix acceptance behind the internal scanner boundary and rejects before effects', () => {
    const options = {dialect: 'native' as const, lexicalPolicy: policy};
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    for (const source of ['10 A%=1', '10 PRINT 1%', '10 DIM A%(2)']) {
      expect(() => tokenize(source)).toThrow(BasicSyntaxError);
      expect(() => parseLine(source, options)).toThrow(BasicSyntaxError);
      expect(() => parseProgram(source, options)).toThrow(BasicSyntaxError);
      expect(() => basic.run('1 PRINT "unreachable"\n' + source)).toThrow(BasicSyntaxError);
    }
    expect(output).toEqual([]);
    basic.run('10 PRINT 4;4.;4E0');
    expect(output).toEqual(['444\n']);
  });

  it('handles a long compact sequence and isolates scans after failure', () => {
    expect(
      scan('10' + 'A1%=32767%:'.repeat(6000) + 'END').filter((t) => t.type === 'NUMBER'),
    ).toHaveLength(6000);
    expect(() => scan('10A%=1%%')).toThrow(BasicSyntaxError);
    expect(scan('10A%=2%')[3]).toMatchObject({raw: '2%', value: 2});
  });
});
