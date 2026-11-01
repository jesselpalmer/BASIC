import {describe, expect, it} from 'bun:test';
import {Basic, BasicSyntaxError, parseLine, parseProgram} from '../index.ts';
import {tokenize} from './tokenizer.ts';
const policy = 'basic-plus-1972-10' as const;
const scan = (source: string) => tokenize(source, {lexicalPolicy: policy});
const values = (source: string) => scan(source).map(({type, value}) => [type, value]);

describe('internal historical single quotes and exclamation comments', () => {
  it('recognizes the manual single-quoted constant without rewriting source', () => {
    expect(values("33 B1$ = 'CAN'")).toEqual([
      ['LABEL', 33],
      ['IDENTIFIER', 'B1$'],
      ['OPERATOR', '='],
      ['STRING', 'CAN'],
      ['EOF', null],
    ]);
    const text = `10PRINT'"NEVERMORE"':PRINT"TIME'S UP"`;
    expect(
      scan(text)
        .filter((t) => t.type === 'STRING')
        .map((t) => [t.raw, t.value]),
    ).toEqual([
      [`'"NEVERMORE"'`, '"NEVERMORE"'],
      [`"TIME'S UP"`, "TIME'S UP"],
    ]);
  });

  it.each(["''", '""', "'!IF:REM\\DATA'", `'"quoted"'`, "'lower case 😀'"])(
    'retains exact raw spelling, payload and UTF-16 positions for %j',
    (literal) => {
      const source = '10PRINT' + literal;
      const token = scan(source).find((t) => t.type === 'STRING')!;
      expect(token.raw).toBe(literal);
      expect(token.value).toBe(literal.slice(1, -1));
      expect(token.start).toEqual({line: 1, column: 8, offset: 7});
      expect(token.end).toEqual({line: 1, column: 8 + literal.length, offset: 7 + literal.length});
    },
  );

  it('keeps adjacent historical quotes separate and native doubled quotes escaped', () => {
    expect(
      scan("10PRINT'A''B'")
        .filter((t) => t.type === 'STRING')
        .map((t) => t.value),
    ).toEqual(['A', 'B']);
    expect(
      scan('10PRINT"A""B"')
        .filter((t) => t.type === 'STRING')
        .map((t) => t.value),
    ).toEqual(['A', 'B']);
    expect(tokenize('10 PRINT "A""B"').find((t) => t.type === 'STRING')?.value).toBe('A"B');
  });

  it.each(["'", "'open", `'open"`, "'before\n20END", "'before\r\n20END"])(
    'locates an unterminated single-quoted string at its opener: %j',
    (literal) => {
      try {
        scan('10PRINT' + literal);
        throw new Error('Expected failure');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicSyntaxError);
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic).toMatchObject({
          code: 'UNTERMINATED_STRING',
          label: 10,
          line: 1,
          column: 8,
          offset: 7,
        });
      }
    },
  );

  it.each(['10!COMMENT', '140 !COMMENT', '10!', '10 !', '10PRINT1! :ELSE DATA\'"\\🙂'])(
    'consumes an exact whole-line or trailing comment: %s',
    (source) => {
      const token = scan(source).find((t) => t.type === 'COMMENT')!;
      const index = source.indexOf('!');
      expect(token.raw).toBe(source.slice(index));
      expect(token.value).toBe(source.slice(index + 1));
      expect(token.start).toEqual({line: 1, column: index + 1, offset: index});
      expect(token.end).toEqual({line: 1, column: source.length + 1, offset: source.length});
      expect(scan(source).at(-1)?.type).toBe('EOF');
    },
  );

  it('resets labels/clauses at CRLF and retains fragment offsets and REM shape', () => {
    const text = `10IFX=1THENPRINT'x'!ELSE PRINT"bad\r\n20REM 'ignore!\n30PRINT'y'`;
    const tokens = tokenize(text, {lexicalPolicy: policy, line: 8, offset: 100});
    expect(tokens.filter((t) => t.type === 'STRING').map((t) => t.value)).toEqual(['x', 'y']);
    const comments = tokens.filter((t) => t.type === 'COMMENT');
    expect(comments.map((t) => [t.raw, t.value, t.label])).toEqual([
      [`!ELSE PRINT"bad`, `ELSE PRINT"bad`, 10],
      [" 'ignore!", " 'ignore!", 20],
    ]);
    const last = tokens.find((t) => t.type === 'STRING' && t.value === 'y')!;
    const offset = text.indexOf("'y'");
    expect(last.start).toEqual({line: 10, column: 8, offset: 100 + offset});
    expect(tokens.filter((t) => t.type === 'NEWLINE').map((t) => t.raw)).toEqual(['\r\n', '\n']);
    expect(() => scan('10IFX=1THENPRINT1!ignored\n20ELSEEND')).toThrow(BasicSyntaxError);
  });

  it('keeps the complete DATA payload separate from comments and quote scanning', () => {
    const tokens = scan(`10DATA!,A!B,'"!"',"'!'"\r\n20PRINT'!'!ignored`);
    expect(tokens.filter((t) => t.type === 'STRING').map((t) => t.value)).toEqual([
      '!',
      'A!B',
      '"!"',
      "'!'",
      '!',
    ]);
    expect(tokens.filter((t) => t.type === 'COMMENT').map((t) => t.value)).toEqual(['ignored']);
    expect(() => scan("10DATA'A'!not-a-comment")).toThrow(BasicSyntaxError);
  });

  it('does not hide malformed labels/prefixes, bare CR or unsupported forms', () => {
    for (const source of [
      '0!comment',
      '32768!comment',
      '10A!comment',
      "10PRINT'x'\\PRINT1",
      '10!comment\r20END',
    ])
      expect(() => scan(source)).toThrow(BasicSyntaxError);
    expect(
      tokenize("!ignored\nPRINT'x'", {numbered: false, lexicalPolicy: policy}).map((t) => [
        t.type,
        t.value,
      ]),
    ).toEqual([
      ['COMMENT', 'ignored'],
      ['NEWLINE', null],
      ['KEYWORD', 'PRINT'],
      ['STRING', 'x'],
      ['EOF', null],
    ]);
  });

  it('scans long protected payloads and many physical lines without retaining state', () => {
    const text = 'FORI=0TO1!'.repeat(10000);
    expect(scan("10PRINT'" + text + "'!" + text).map((t) => t.type)).toEqual([
      'LABEL',
      'KEYWORD',
      'STRING',
      'COMMENT',
      'EOF',
    ]);
    const lines = Array.from({length: 1000}, (_, i) => `${i + 1}!ignored`).join('\n');
    expect(scan(lines).filter((t) => t.type === 'COMMENT')).toHaveLength(1000);
    expect(values('10!')).toEqual([
      ['LABEL', 10],
      ['COMMENT', ''],
      ['EOF', null],
    ]);
  });

  it('cannot enable historical quotes/comments through public option-shaped input', () => {
    const options = {dialect: 'native' as const};
    Reflect.set(options, 'lexicalPolicy', policy);
    for (const source of ["10 PRINT 'CAN'", '10 PRINT 1!ignored']) {
      expect(() => tokenize(source)).toThrow(BasicSyntaxError);
      expect(() => parseLine(source, options)).toThrow(BasicSyntaxError);
      expect(() => parseProgram(source, options)).toThrow(BasicSyntaxError);
      const writes: string[] = [];
      const basic = new Basic({write: (t) => writes.push(t)}, options);
      expect(() => basic.run('5 PRINT "never"\n' + source)).toThrow(BasicSyntaxError);
      expect(writes).toEqual([]);
    }
    expect(parseProgram('10 PRINT "A""B"', options).lines[0].statement.type).toBe('PrintStatement');
  });
});
