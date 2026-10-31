import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseLine, parseProgram} from '../index.ts';
import {tokenize} from './tokenizer.ts';

const policy = 'basic-plus-1972-10' as const;
const scan = (source: string) => tokenize(source, {lexicalPolicy: policy});
const data = (source: string) => scan(source).filter(({type}) => type === 'STRING');

function failure(source: string, code: string) {
  try {
    scan(source);
    throw Error('Expected failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}

describe('internal historical DATA source mode', () => {
  it('retains the printed numeric/string DATA examples as text without conversion', () => {
    expect(data('20 DATA 17, 14, 13.4, CAT').map(({value}) => value)).toEqual([
      '17',
      '14',
      '13.4',
      'CAT',
    ]);
    expect(
      data('330DATA4,2,1.7\n340DATA6.734E-3, -174.321, 3.1415927').map(({value}) => value),
    ).toEqual(['4', '2', '1.7', '6.734E-3', '-174.321', '3.1415927']);
    expect(data('10DATA0017,+2,1E999,1e-3,32768%,A+1').map(({value}) => value)).toEqual([
      '0017',
      '+2',
      '1E999',
      '1e-3',
      '32768%',
      'A+1',
    ]);
  });

  it('matches the manual quote/space example and protects the opposite quote', () => {
    const source = `40 DATA "MR. JONES",MISS SMITH, "MRS. BROWN", "MISS", '"MR"'`;
    expect(data(source).map(({value}) => value)).toEqual([
      'MR. JONES',
      'MISSSMITH',
      'MRS. BROWN',
      'MISS',
      '"MR"',
    ]);
    expect(data(`10DATA'HE SAID "YES"',"DON'T",'',""`).map(({value}) => value)).toEqual([
      'HE SAID "YES"',
      "DON'T",
      '',
      '',
    ]);
  });

  it('removes only unquoted ASCII spaces while retaining raw field spelling', () => {
    const tokens = data('10DATA  C A T  ,  " A B "  , + 0 0 1  ');
    expect(tokens.map(({raw, value}) => ({raw, value}))).toEqual([
      {raw: '  C A T  ', value: 'CAT'},
      {raw: '" A B "', value: ' A B '},
      {raw: ' + 0 0 1  ', value: '+001'},
    ]);
  });

  it('protects words, exclamation marks and quoted separators from expression scanning', () => {
    const source = `10DATAFORI=0TO12,REM !comment,PI%,"A:B\\C,!DATA",'IF"THEN"ELSE'`;
    const tokens = scan(source);
    expect(tokens.filter(({type}) => type === 'KEYWORD').map(({value}) => value)).toEqual(['DATA']);
    expect(tokens.some(({type}) => type === 'COMMENT')).toBe(false);
    expect(data(source).map(({value}) => value)).toEqual([
      'FORI=0TO12',
      'REM!comment',
      'PI%',
      'A:B\\C,!DATA',
      'IF"THEN"ELSE',
    ]);
    expect(data('10DATA!').map(({value}) => value)).toEqual(['!']);
  });

  it('enters after a compact statement and resets on LF/CRLF physical lines', () => {
    const source = '10A=1:DATAONE,2\r\n20READA$:RESTORE\n30DATAEND\n40END';
    expect(scan(source).map(({type, value}) => [type, value])).toEqual([
      ['LABEL', 10],
      ['IDENTIFIER', 'A'],
      ['OPERATOR', '='],
      ['NUMBER', 1],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'DATA'],
      ['STRING', 'ONE'],
      ['PUNCTUATION', ','],
      ['STRING', '2'],
      ['NEWLINE', null],
      ['LABEL', 20],
      ['KEYWORD', 'READ'],
      ['IDENTIFIER', 'A$'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'RESTORE'],
      ['NEWLINE', null],
      ['LABEL', 30],
      ['KEYWORD', 'DATA'],
      ['STRING', 'END'],
      ['NEWLINE', null],
      ['LABEL', 40],
      ['KEYWORD', 'END'],
      ['EOF', null],
    ]);
    expect(tokenize('DATA1', {numbered: false, lexicalPolicy: policy})[1]).toMatchObject({
      type: 'STRING',
      value: '1',
      raw: '1',
    });
    expect(data('10IF1=1THENDATAabc').map(({value}) => value)).toEqual(['abc']);
  });

  it('preserves exact physical UTF-16 spans and fragment coordinates', () => {
    const source = `\t10DATA  A B , ' C,D '  \r\n20DATA"E"\n`;
    const tokens = tokenize(source, {lexicalPolicy: policy, line: 5, offset: 100});
    expect(tokens[2]).toMatchObject({
      type: 'STRING',
      raw: '  A B ',
      value: 'AB',
      label: 10,
      start: {line: 5, column: 8, offset: 107},
      end: {line: 5, column: 14, offset: 113},
    });
    expect(tokens.find(({raw}) => raw === `' C,D '`)).toMatchObject({
      value: ' C,D ',
      start: {line: 5, column: 16, offset: 115},
      end: {line: 5, column: 23, offset: 122},
    });
    for (const token of tokens)
      expect(source.slice(token.start.offset - 100, token.end.offset - 100)).toBe(token.raw);
    expect(tokens.find(({raw}) => raw === '"E"')).toMatchObject({
      label: 20,
      start: {line: 6, column: 7, offset: 132},
    });
  });

  it.each([
    '10DATA',
    '10DATA   ',
    '10DATA,1',
    '10DATA1,,2',
    '10DATA1,',
    '10DATA1,  ',
    '10DATA"X"junk',
    '10DATA"X"\t',
    '10DATA"X"\r',
    '10DATA"X""Y"',
    "10DATA'X''Y'",
  ])('rejects malformed list or quoted suffix: %s', (source) => {
    failure(source, 'INVALID_DATA');
  });

  it.each(['10DATA"X', "10DATA'X", '10DATA"X\r\n20END', "10DATA'X\n20END"])(
    'rejects unclosed fields without joining lines: %s',
    (source) => {
      expect(failure(source, 'UNTERMINATED_STRING')).toMatchObject({label: 10, column: 7});
    },
  );

  it.each([
    '10DATAA:B',
    '10DATAA\\B',
    '10DATAA"B',
    "10DATAA'B",
    '10DATAA\tB',
    '10DATA"A\tB"',
    '10DATA\t"A"',
    '10DATAA\rB',
    '10DATA\u0080',
    '10DATA"\u00ff"',
    '10DATA🙂',
    '10DATA"A\u0000B"',
    '10PRINTDATA1',
  ])('explicitly rejects unresolved data character/delimiter: %s', (source) => {
    failure(source, 'UNSUPPORTED_LEXICAL_FORM');
  });

  it('reports the exact field or offending delimiter location', () => {
    expect(failure('10DATAA,,B', 'INVALID_DATA')).toMatchObject({
      label: 10,
      line: 1,
      column: 9,
      offset: 8,
    });
    expect(failure('10DATAA:B', 'UNSUPPORTED_LEXICAL_FORM')).toMatchObject({
      label: 10,
      column: 8,
      offset: 7,
    });
    expect(failure('10DATA"A"junk', 'INVALID_DATA')).toMatchObject({
      label: 10,
      column: 10,
      offset: 9,
    });
  });

  it('enforces field count before beginning an extra field', () => {
    expect(data('10DATA' + Array.from({length: 4096}, () => 'A').join(','))).toHaveLength(4096);
    expect(
      failure('10DATA' + Array.from({length: 4097}, () => 'A').join(','), 'DATA_LIMIT'),
    ).toMatchObject({label: 10, column: 8199});
    failure('10DATA' + 'A,'.repeat(4096), 'DATA_LIMIT');
  });

  it('enforces decoded field length in both quote modes and unquoted text', () => {
    for (const quote of ['', '"', "'"]) {
      expect(data('10DATA' + quote + 'A'.repeat(32767) + quote)[0].value).toHaveLength(32767);
      failure('10DATA' + quote + 'A'.repeat(32768) + quote, 'DATA_LIMIT');
    }
  });

  it('bounds total raw payload before token allocation, including ignored spaces', () => {
    const payload = ' '.repeat(262143) + 'A';
    expect(data('10DATA' + payload)[0]).toMatchObject({raw: payload, value: 'A'});
    expect(data('10DATA' + payload + '\r\n20END')[0].value).toBe('A');
    failure('10DATA ' + payload, 'DATA_LIMIT');
    failure('10DATA ' + payload + '\r\n20END', 'DATA_LIMIT');
    failure('10DATA"' + payload, 'DATA_LIMIT');
  });

  it('never changes native token/AST or typed DATA execution behavior', () => {
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    const source = '10 DATA 17,"C""AT"\n20 READ A,B$:PRINT A;B$';
    const options = {dialect: 'native' as const, lexicalPolicy: policy};
    expect(parseProgram(source, options)).toEqual(parseProgram(source));
    expect(parseLine('10 DATA - 1.5e+2,"C""AT"', options)?.statement).toMatchObject({
      type: 'DataStatement',
      items: [
        {type: 'NumberLiteral', value: -150},
        {type: 'StringLiteral', value: 'C"AT'},
      ],
    });
    expect(tokenize('10 DATA 17,"CAT"').map(({type, value}) => [type, value])).toEqual([
      ['LABEL', 10],
      ['IDENTIFIER', 'DATA'],
      ['NUMBER', 17],
      ['PUNCTUATION', ','],
      ['STRING', 'CAT'],
      ['EOF', null],
    ]);
    basic.run(source);
    expect(output).toEqual(['17C"AT\n']);
    basic.run('10 DIM DATA(0):DATA=2:DATA(0)=3:PRINT DATA;DATA(0)');
    expect(output.at(-1)).toBe('23\n');
  });

  it('keeps historical DATA behind the scanner boundary and rejects before effects', () => {
    const options = {dialect: 'native' as const, lexicalPolicy: policy};
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    for (const source of ['10 DATA CAT', "10 DATA 'CAT'", '10DATA17', '10 DATA 17:REM nope']) {
      expect(() => parseLine(source, options)).toThrow(BasicSyntaxError);
      expect(() => parseProgram(source, options)).toThrow(BasicSyntaxError);
      expect(() => basic.run('1 PRINT "unreachable"\n' + source)).toThrow(BasicSyntaxError);
    }
    expect(output).toEqual([]);
  });

  it('bounds many independent physical lists and isolates failures between calls', () => {
    const source = Array.from({length: 6000}, (_, index) => `${index + 1}DATAX,0017`).join('\n');
    expect(data(source)).toHaveLength(12000);
    failure('10DATA"unterminated', 'UNTERMINATED_STRING');
    expect(data('10DATAX,0017').map(({value}) => value)).toEqual(['X', '0017']);
    expect(scan('10REM DATA"unterminated').find(({type}) => type === 'COMMENT')).toMatchObject({
      type: 'COMMENT',
      value: ' DATA"unterminated',
    });
  });
});
