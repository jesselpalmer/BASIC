import {describe, expect, test} from 'bun:test';
import {Basic, BasicSyntaxError, parseProgram} from '../index.ts';
import {historicalNumericSpelling} from './historical_numeric.ts';
import {tokenize} from './tokenizer.ts';
import {basicPlusMa2DecimalLiteral} from '../core/basic_plus_ma2_decimal.ts';
import reference from '../core/__tests__/ma2-decimal-reference.json';

const lexicalPolicy = 'basic-plus-1972-10' as const;

describe('raw historical numeric tokens', () => {
  test.each(reference.rows.map((row, index) => [index, row] as const))(
    'preserves original ATOF input spelling %i without host conversion',
    (_index, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Invalid reference');
      const source = '\t10PRINT' + raw + '\r\n20END';
      const tokens = tokenize(source, {lexicalPolicy, line: 4, offset: 80});
      const numbers = tokens.filter((token) => token.type === 'RAW_NUMBER');
      expect(numbers).toHaveLength(1);
      expect(numbers[0]).toMatchObject({
        type: 'RAW_NUMBER',
        raw,
        value: null,
        label: 10,
        start: {line: 4, column: 9, offset: 88},
        end: {line: 4, column: 9 + raw.length, offset: 88 + raw.length},
      });
      expect(tokens.filter((token) => token.type === 'NUMBER')).toHaveLength(0);
      for (const token of tokens)
        expect(source.slice(token.start.offset - 80, token.end.offset - 80)).toBe(token.raw);
      const converted = basicPlusMa2DecimalLiteral(numbers[0].raw);
      if (mask !== 0) expect(converted).toEqual({kind: 'unsupported', reason: 'numeric-event'});
      else if (psw & 2)
        expect(converted).toEqual({kind: 'unsupported', reason: 'conversion-status'});
      else expect(converted).toEqual({kind: 'value', words: [high, low]});
    },
  );
  test.each([
    '1E999',
    '1E-999',
    '0E32768',
    '9'.repeat(400),
    '0'.repeat(400) + '1',
    '1E' + '9'.repeat(400),
  ])('retains lexically valid magnitude beyond host range or precision: %s', (raw) => {
    expect(tokenize('10PRINT' + raw, {lexicalPolicy})[2]).toMatchObject({
      type: 'RAW_NUMBER',
      raw,
      value: null,
    });
    const descriptor = historicalNumericSpelling(raw);
    expect(descriptor).toEqual({raw, kind: raw.includes('E') ? 'floating' : 'whole'});
    expect(Object.hasOwn(descriptor, 'value')).toBe(false);
    expect(Object.isFrozen(descriptor)).toBe(true);
  });
  test('compares integer spelling range lexically and keeps leading zeros', () => {
    for (const raw of ['0%', '000%', '32767%', '0'.repeat(1000) + '32767%']) {
      expect(historicalNumericSpelling(raw)).toEqual({raw, kind: 'integer'});
      expect(tokenize('10PRINT' + raw, {lexicalPolicy})[2]).toMatchObject({
        type: 'RAW_NUMBER',
        raw,
        value: null,
      });
    }
    for (const raw of ['32768%', '0'.repeat(1000) + '32768%', '9'.repeat(1000) + '%'])
      expect(() => historicalNumericSpelling(raw)).toThrow(RangeError);
  });
  test('keeps separate signs and protects DATA, quotes, comments and labels', () => {
    const source = '010A=-1.0000001:PRINT"1E999"\r\n20DATA1E999,"123"\n30REM 1E999';
    const tokens = tokenize(source, {lexicalPolicy});
    expect(tokens.filter((token) => token.type === 'RAW_NUMBER').map((token) => token.raw)).toEqual(
      ['1.0000001'],
    );
    expect(tokens.find((token) => token.type === 'OPERATOR' && token.raw === '-')).toMatchObject({
      value: '-',
    });
    expect(tokens.filter((token) => token.type === 'LABEL').map((token) => token.value)).toEqual([
      10, 20, 30,
    ]);
    expect(tokens.filter((token) => token.type === 'STRING').map((token) => token.value)).toEqual([
      '1E999',
      '1E999',
      '123',
    ]);
    expect(tokens.find((token) => token.type === 'COMMENT')?.raw).toBe(' 1E999');
  });
  test('preserves native numeric tokens and AST values while public activation stays rejected', () => {
    const raw = '1.0000001';
    expect(tokenize('10 PRINT ' + raw)[2]).toMatchObject({type: 'NUMBER', raw, value: 1.0000001});
    const statement = parseProgram('10 PRINT ' + raw).lines[0].statement;
    if (statement.type !== 'PrintStatement') throw new Error('Expected PRINT');
    expect(statement.items[0]).toMatchObject({type: 'NumberLiteral', raw, value: 1.0000001});
    const options = {dialect: 'native' as const, lexicalPolicy};
    expect(() => parseProgram('10 PRINT 1E999', options)).toThrow(BasicSyntaxError);
    expect(() => new Basic(undefined, {dialect: 'basic-plus-v4a12-ma2' as 'native'})).toThrow(
      TypeError,
    );
    const output: string[] = [];
    expect(() =>
      new Basic({write: (text) => output.push(text)}).run('10 PRINT "before"\n20 PRINT 1E999'),
    ).toThrow(BasicSyntaxError);
    expect(output).toEqual([]);
  });
  test('keeps malformed spellings strict and recovers independently', () => {
    for (const raw of ['1E+', '1.2.3', '.', '-1', '+1', '1e2', '1E0%'])
      expect(() => historicalNumericSpelling(raw)).toThrow(SyntaxError);
    expect(() => {
      Reflect.apply(historicalNumericSpelling, null, [
        {
          toString() {
            throw new Error('coerced');
          },
        },
      ]);
    }).toThrow(TypeError);
    const source = '10' + 'A=1E999:'.repeat(6000) + 'END';
    expect(
      tokenize(source, {lexicalPolicy}).filter((token) => token.type === 'RAW_NUMBER'),
    ).toHaveLength(6000);
    expect(() => tokenize('10A=1E+', {lexicalPolicy})).toThrow(BasicSyntaxError);
    expect(tokenize('10A=2', {lexicalPolicy})[3]).toMatchObject({
      type: 'RAW_NUMBER',
      raw: '2',
      value: null,
    });
  });
});
