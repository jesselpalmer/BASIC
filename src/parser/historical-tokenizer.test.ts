import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, Evaluator, parseLine, parseProgram} from '../index.ts';
import {tokenize} from './tokenizer.ts';
import {scannerPolicy} from './lexical_policy.ts';

const policy = 'basic-plus-1972-10' as const;
const scan = (source: string) => tokenize(source, {lexicalPolicy: policy});
const values = (source: string) => scan(source).map(({type, value}) => [type, value]);

function failure(source: string, code: string) {
  try {
    scan(source);
    throw new Error('Expected a lexical failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return error.diagnostic;
  }
}

describe('internal BASIC-PLUS1972 scanner conformance', () => {
  it('keeps policy objects immutable and unknown internal selections explicit', () => {
    expect(Object.isFrozen(scannerPolicy())).toBe(true);
    expect(Object.isFrozen(scannerPolicy(policy))).toBe(true);
    for (const selection of ['basic-plus', 'unknown', null, 1, {}]) {
      const options: Parameters<typeof tokenize>[1] = {};
      Reflect.set(options, 'lexicalPolicy', selection);
      expect(() => tokenize('10 END', options)).toThrow(TypeError);
    }
  });

  it('separates compact labels, assignment verbs and short variables without rewriting source', () => {
    expect(values('10LETA1=2')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'LET'],
      ['IDENTIFIER', 'A1'],
      ['OPERATOR', '='],
      ['NUMBER', 2],
      ['EOF', null],
    ]);
    expect(values('10A$="FORI=0TO12"')).toEqual([
      ['LABEL', 10],
      ['IDENTIFIER', 'A$'],
      ['OPERATOR', '='],
      ['STRING', 'FORI=0TO12'],
      ['EOF', null],
    ]);
    expect(values('10READN1:NEXTI:RESTORE:RETURN:END')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'READ'],
      ['IDENTIFIER', 'N1'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'NEXT'],
      ['IDENTIFIER', 'I'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'RESTORE'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'RETURN'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'END'],
      ['EOF', null],
    ]);
  });

  it('retains the documented AWARI compact FOR boundaries including P followed by TO', () => {
    expect(values('605FORP=PTO1STEP-1')).toEqual([
      ['LABEL', 605],
      ['KEYWORD', 'FOR'],
      ['IDENTIFIER', 'P'],
      ['OPERATOR', '='],
      ['IDENTIFIER', 'P'],
      ['KEYWORD', 'TO'],
      ['NUMBER', 1],
      ['KEYWORD', 'STEP'],
      ['OPERATOR', '-'],
      ['NUMBER', 1],
      ['EOF', null],
    ]);
    expect(values('15FORI=0TO12')).toEqual([
      ['LABEL', 15],
      ['KEYWORD', 'FOR'],
      ['IDENTIFIER', 'I'],
      ['OPERATOR', '='],
      ['NUMBER', 0],
      ['KEYWORD', 'TO'],
      ['NUMBER', 12],
      ['EOF', null],
    ]);
  });

  it('retains both nested LIFE2 comparisons and literal targets', () => {
    expect(values('101IFJ<>0THENIFJ<>6THEN105')).toEqual([
      ['LABEL', 101],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'J'],
      ['OPERATOR', '<>'],
      ['NUMBER', 0],
      ['KEYWORD', 'THEN'],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'J'],
      ['OPERATOR', '<>'],
      ['NUMBER', 6],
      ['KEYWORD', 'THEN'],
      ['NUMBER', 105],
      ['EOF', null],
    ]);
  });

  it('uses clause context for short-name delimiters and nested IF/ELSE transitions', () => {
    expect(values('10FORI=XTOYSTEPZ:NEXTI')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'FOR'],
      ['IDENTIFIER', 'I'],
      ['OPERATOR', '='],
      ['IDENTIFIER', 'X'],
      ['KEYWORD', 'TO'],
      ['IDENTIFIER', 'Y'],
      ['KEYWORD', 'STEP'],
      ['IDENTIFIER', 'Z'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'NEXT'],
      ['IDENTIFIER', 'I'],
      ['EOF', null],
    ]);
    expect(values('10IFJ=1THENIFI=2THENPRINT1ELSEPRINT2ELSEEND')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'J'],
      ['OPERATOR', '='],
      ['NUMBER', 1],
      ['KEYWORD', 'THEN'],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'I'],
      ['OPERATOR', '='],
      ['NUMBER', 2],
      ['KEYWORD', 'THEN'],
      ['KEYWORD', 'PRINT'],
      ['NUMBER', 1],
      ['KEYWORD', 'ELSE'],
      ['KEYWORD', 'PRINT'],
      ['NUMBER', 2],
      ['KEYWORD', 'ELSE'],
      ['KEYWORD', 'END'],
      ['EOF', null],
    ]);
    expect(values('10IFJ=1GOTO20:PRINT1\n20A (1)=2')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'J'],
      ['OPERATOR', '='],
      ['NUMBER', 1],
      ['KEYWORD', 'GOTO'],
      ['NUMBER', 20],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'PRINT'],
      ['NUMBER', 1],
      ['NEWLINE', null],
      ['LABEL', 20],
      ['IDENTIFIER', 'A'],
      ['PUNCTUATION', '('],
      ['NUMBER', 1],
      ['PUNCTUATION', ')'],
      ['OPERATOR', '='],
      ['NUMBER', 2],
      ['EOF', null],
    ]);
  });

  it.each([
    'STOP',
    'PRINTSTOP',
    'FORI=STOP',
    'LINPUTA$',
    'PRINTLINPUTA$',
    'FORI=LINPUTA$',
    'PRINT1TO2',
    'LETA=2STEP3',
    'READATHEN10',
    'ELSEEND',
    'PRINT1IFJ=2',
    'PRINT1FORI=1TO2',
    'IFJ=1THENPRINT1:ELSEEND',
    'IFJ=1THENPRINT1\n20ELSEEND',
    'PRINTGOTO20',
    'ABS(1)',
    'IFJ==1THEN20',
  ])(
    'rejects unsupported words or misplaced delimiters rather than inventing a valid clause: %s',
    (source) => {
      failure('10' + source, 'UNSUPPORTED_LEXICAL_FORM');
    },
  );

  it.each([
    'IMAGE',
    'STOP',
    'CHANGE',
    'MAT',
    'DEF',
    'FNEND',
    'RANDOMIZE',
    'RANDOM',
    'OPEN',
    'CLOSE',
    'NAME',
    'KILL',
    'RESUME',
    'CHAIN',
    'UNLESS',
    'WHILE',
    'UNTIL',
    'SLEEP',
    'WAIT',
    'LSET',
    'RSET',
    'FIELD',
    'GET',
    'PUT',
    'UNLOCK',
    'LINE',
    'USING',
    'ERROR',
  ])('rejects the recognized but unimplemented historical word %s before its payload', (word) => {
    expect(failure('10' + word + '"FORI=0TO12"', 'UNSUPPORTED_LEXICAL_FORM')).toMatchObject({
      label: 10,
      column: 3,
    });
  });

  it('distinguishes E exponents, E variables and following ELSE/END words', () => {
    expect(values('10IFE3=1E-3THENPRINT1ELSEEND')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'IF'],
      ['IDENTIFIER', 'E3'],
      ['OPERATOR', '='],
      ['NUMBER', 0.001],
      ['KEYWORD', 'THEN'],
      ['KEYWORD', 'PRINT'],
      ['NUMBER', 1],
      ['KEYWORD', 'ELSE'],
      ['KEYWORD', 'END'],
      ['EOF', null],
    ]);
    expect(values('10PRINT.5;1.;2E+3;E')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'PRINT'],
      ['NUMBER', 0.5],
      ['PUNCTUATION', ';'],
      ['NUMBER', 1],
      ['PUNCTUATION', ';'],
      ['NUMBER', 2000],
      ['PUNCTUATION', ';'],
      ['IDENTIFIER', 'E'],
      ['EOF', null],
    ]);
  });

  it('recognizes the closed elementary transfer and function vocabulary', () => {
    expect(values('10ONINT(ABS(-2))GOSUB100,200:INPUTA$')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'ON'],
      ['KEYWORD', 'INT'],
      ['PUNCTUATION', '('],
      ['KEYWORD', 'ABS'],
      ['PUNCTUATION', '('],
      ['OPERATOR', '-'],
      ['NUMBER', 2],
      ['PUNCTUATION', ')'],
      ['PUNCTUATION', ')'],
      ['KEYWORD', 'GOSUB'],
      ['NUMBER', 100],
      ['PUNCTUATION', ','],
      ['NUMBER', 200],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'INPUT'],
      ['IDENTIFIER', 'A$'],
      ['EOF', null],
    ]);
    expect(values('10DIMA(2):GOTO20:PRINTRND')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'DIM'],
      ['IDENTIFIER', 'A'],
      ['PUNCTUATION', '('],
      ['NUMBER', 2],
      ['PUNCTUATION', ')'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'GOTO'],
      ['NUMBER', 20],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'PRINT'],
      ['KEYWORD', 'RND'],
      ['EOF', null],
    ]);
  });

  it('recognizes the reviewed numeric inventory and matches LOG10 before LOG', () => {
    const source =
      '10PRINTABS(A);SGN(A);INT(A);FIX(A);COS(A);SIN(A);TAN(A);ATN(A);SQR(A);EXP(A);LOG10(A);LOG(A);PI;RND;RND(A)';
    const tokens = scan(source);
    expect(tokens.filter(({type}) => type === 'KEYWORD').map(({value}) => value)).toEqual([
      'PRINT',
      'ABS',
      'SGN',
      'INT',
      'FIX',
      'COS',
      'SIN',
      'TAN',
      'ATN',
      'SQR',
      'EXP',
      'LOG10',
      'LOG',
      'PI',
      'RND',
      'RND',
    ]);
    const log10 = tokens.find(({value}) => value === 'LOG10');
    expect(log10).toMatchObject({
      raw: 'LOG10',
      start: {column: source.indexOf('LOG10') + 1, offset: source.indexOf('LOG10')},
    });
  });

  it.each(['LOG100', 'LOG1', 'PI$', 'SQRT(A)', 'SINH(A)'])(
    'rejects an unsupported intrinsic-like prefix instead of splitting %s',
    (name) => {
      failure('10PRINT' + name, 'UNSUPPORTED_LEXICAL_FORM');
    },
  );

  it.each(['1e2', '1e+2', '.5e-2'])(
    'rejects unsupported lowercase exponent spelling at its physical e: %s',
    (raw) => {
      const source = '10PRINT' + raw;
      expect(failure(source, 'UNSUPPORTED_LEXICAL_FORM')).toMatchObject({
        label: 10,
        column: source.indexOf('e') + 1,
        offset: source.indexOf('e'),
      });
      expect(tokenize('10 PRINT ' + raw)[2].value).toBe(Number(raw));
    },
  );

  it('preserves strings and REM tails instead of splitting their apparent words', () => {
    expect(values('10PRINT"FORI=0TO12""NEXTI":REM !DATA"oops\\🙂')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'PRINT'],
      ['STRING', 'FORI=0TO12'],
      ['STRING', 'NEXTI'],
      ['PUNCTUATION', ':'],
      ['KEYWORD', 'REM'],
      ['COMMENT', ' !DATA"oops\\🙂'],
      ['EOF', null],
    ]);
    expect(values('10PRINT""')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'PRINT'],
      ['STRING', ''],
      ['EOF', null],
    ]);
    expect(values('10REM')).toEqual([
      ['LABEL', 10],
      ['KEYWORD', 'REM'],
      ['COMMENT', ''],
      ['EOF', null],
    ]);
    failure('10PRINT"unfinished\r\n20END', 'UNTERMINATED_STRING');
  });

  it('keeps physical UTF-16 positions across compact tokens, tabs, CRLF and fragments', () => {
    const source = '\t010FORI=0TO2\r\n20PRINT"🙂"\n';
    const tokens = tokenize(source, {lexicalPolicy: policy, line: 4, offset: 80});
    expect(tokens[0]).toMatchObject({raw: '010', start: {line: 4, column: 2, offset: 81}});
    expect(tokens[1]).toMatchObject({raw: 'FOR', start: {line: 4, column: 5, offset: 84}});
    expect(tokens.find((t) => t.type === 'STRING')).toMatchObject({
      value: '🙂',
      start: {line: 5, column: 8, offset: 102},
      end: {line: 5, column: 12, offset: 106},
    });
    for (const token of tokens)
      expect(source.slice(token.start.offset - 80, token.end.offset - 80)).toBe(token.raw);
    expect(tokenize('PRINTA', {lexicalPolicy: policy, numbered: false})[0]).toMatchObject({
      type: 'KEYWORD',
      value: 'PRINT',
      start: {line: 1, column: 1, offset: 0},
    });
  });

  it.each(['1', '32767', '00010'])('accepts inclusive historical label %s', (label) => {
    expect(scan(`${label}END`)[0].value).toBe(Number(label));
  });

  it.each(['0', '32768', '-1', '+1', '1.5', ':', '9'.repeat(400)])(
    'rejects malformed or out-of-range historical label %s',
    (label) => {
      expect(failure(`${label} END`, 'INVALID_LABEL')).toMatchObject({line: 1, column: 1});
    },
  );

  it.each(['1E', '1E+', '1E-TO2', '1.2.3', '.', '12oops', '1E2A', '12$', '9'.repeat(400)])(
    'rejects malformed/nonfinite complete numeric spelling %s',
    (raw) => {
      expect(failure(`10PRINT${raw}`, 'INVALID_NUMBER')).toMatchObject({label: 10, column: 8});
    },
  );

  it.each([
    'IMAGE"###"',
    "PRINT'x'",
    '!comment',
    'PRINT1\\PRINT2',
    'letA=1',
    'FORWARD=1',
    'INTEGER=2',
    'SCORE=3',
    'LETA12=1',
    'PRINTA$B$',
  ])('rejects unsupported/ambiguous lexical form before returning tokens: %s', (source) => {
    failure('10 ' + source, 'UNSUPPORTED_LEXICAL_FORM');
  });

  it('retains ordinary native names, escapes, errors and the default label range', () => {
    expect(
      tokenize('65535 LET FORWARD=INTEGER+SCORE').map(({type, value}) => [type, value]),
    ).toEqual([
      ['LABEL', 65535],
      ['KEYWORD', 'LET'],
      ['IDENTIFIER', 'FORWARD'],
      ['OPERATOR', '='],
      ['IDENTIFIER', 'INTEGER'],
      ['OPERATOR', '+'],
      ['IDENTIFIER', 'SCORE'],
      ['EOF', null],
    ]);
    expect(tokenize('10 PRINT "a""b"')[2].value).toBe('a"b');
    expect(() => tokenize('10PRINT1')).toThrow(BasicSyntaxError);
    expect(() => tokenize('10 PRINT 1TO2')).toThrow(BasicSyntaxError);
    expect(tokenize('10 DATA=2')[1]).toMatchObject({type: 'IDENTIFIER', value: 'DATA'});
  });

  it('never enables historical parsing or execution through public options or metadata', () => {
    const internalLooking = {dialect: 'native' as const, lexicalPolicy: policy};
    expect(() => parseLine('10PRINT1', internalLooking)).toThrow(BasicSyntaxError);
    expect(() => parseProgram('10PRINT1', internalLooking)).toThrow(BasicSyntaxError);
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)}, internalLooking);
    expect(() => basic.run('10PRINT1')).toThrow(BasicSyntaxError);
    expect(new Evaluator(undefined, internalLooking).dialect).toBe('native');
    basic.run('10 PRINT "kept"');
    const candidate = structuredClone(parseProgram('10 END'));
    Reflect.set(candidate, 'dialect', policy);
    expect(() => basic.run(candidate)).toThrow(TypeError);
    const badOptions = {dialect: 'native' as const};
    Reflect.set(badOptions, 'dialect', policy);
    expect(() => parseProgram('10 END', badOptions)).toThrow(TypeError);
    expect(() => new Basic(undefined, badOptions)).toThrow(TypeError);
    expect(() => new Evaluator(undefined, badOptions)).toThrow(TypeError);
    basic.run();
    expect(output).toEqual(['kept\n', 'kept\n']);
  });

  it('does linear token work on long compact input and isolates failed selections', () => {
    const source = '10' + 'LETA1=1E-3:'.repeat(10000) + 'END';
    const first = scan(source);
    expect(first.length).toBe(50003);
    expect(first.at(-2)).toMatchObject({type: 'KEYWORD', value: 'END'});
    failure('10IMAGE"ignored"', 'UNSUPPORTED_LEXICAL_FORM');
    expect(scan('10END')).toEqual(scan('10END'));
    expect(tokenize('10 LET A=2')).toEqual(tokenize('10 LET A=2', {lexicalPolicy: 'native'}));
  });
});
