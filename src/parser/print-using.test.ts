import {describe, expect, it} from 'bun:test';
import {BasicSyntaxError, parseLine, parseProgram, validateProgram} from '../index.ts';
import type {NodeOf, ParsedLine} from '../core/types.ts';

function formatted(source: string): NodeOf<'PrintUsingStatement'> {
  const statement = parseLine(source)?.statement;
  if (statement?.type !== 'PrintUsingStatement') throw new Error('Expected PRINT USING');
  return statement;
}

describe('contextual PRINT USING syntax', () => {
  it.each([
    'PRINT USING "##",1',
    'print using B$,J',
    'PRINT USING ("#"+"#"),1;',
    'PRINT USING("##"),1',
    'PRINT USING T$(1,2),A(1,2),ABS(-2)',
  ])('accepts complete format/value expressions: %s', (source) => {
    expect(formatted('10 ' + source).format).toBeDefined();
  });

  it.each([
    'PRINT USING',
    'PRINT USING+1',
    'PRINT USING$',
    'PRINT USING(1,2)',
    'PRINT USING (1)',
    'PRINT USING B$;J',
    'PRINT USING "comma,in string"',
    'PRINT USING$ A(1,2)',
  ])('preserves ordinary PRINT: %s', (source) => {
    expect(parseLine('10 ' + source)?.statement.type).toBe('PrintStatement');
  });

  it('stops lookahead at line endings and preserves source, frozen AST and physical punctuation', () => {
    const source = '  70 pRiNt UsInG ("##"),A(1,2),-3;  ';
    const line = parseLine(source, {line: 7, offset: 80});
    expect(line?.source).toBe(source);
    const statement = line?.statement;
    if (statement?.type !== 'PrintUsingStatement') throw new Error('Expected formatted statement');
    expect(statement.format.type).toBe('GroupExpression');
    expect(statement.items.map(({type}) => type)).toEqual(['ArrayReference', 'UnaryExpression']);
    expect(statement.separators.map(({start}) => [start.line, start.column, start.offset])).toEqual(
      [
        [7, 24, 103],
        [7, 31, 110],
        [7, 34, 113],
      ],
    );
    expect(statement.trailingSemicolon).toBe(true);
    expect(statement.location.end.column).toBe(35);
    expect(Object.isFrozen(statement.items)).toBe(true);
    const program = parseProgram('10 USING=1\n20 PRINT USING\n30 PRINT USING "##",1');
    expect(program.lines[1].statement.type).toBe('PrintStatement');
    expect(program.lines[2].statement.type).toBe('PrintUsingStatement');
  });

  it.each([
    'PRINT USING "##";1,2',
    'PRINT USING "##",',
    'PRINT USING "##",1,',
    'PRINT USING "##",1;2',
    'PRINT USING "##",1 2',
    'PRINT USING "##",1"x"',
    'PRINT USING "##",;',
    'PRINT USING ),1',
    'PRINT USING("##",1',
    'PRINT USING "##",ABS(1 2)',
    'PRINT USING "##",1;;',
    'PRINT USING #1,"##",1',
    'PRINT USING "##" 1,2',
  ])('rejects malformed/unsupported formatting: %s', (source) => {
    expect(() => parseLine('10 ' + source)).toThrow(BasicSyntaxError);
  });

  it('preflights template type, list work and references without evaluating source', () => {
    for (const source of ['10 PRINT USING 1,2', '10 DIM A(1)\n20 PRINT USING A(0),1']) {
      expect(() => parseProgram(source)).toThrow('PRINT USING requires a string image');
    }
    const source = '10 PRINT USING "#",' + Array(4097).fill('RND()').join(',');
    expect(() => parseLine(source)).toThrow('at most 4096 values');
    expect(() => parseProgram(source)).toThrow('at most 4096 values');
    const base = parseLine('10 PRINT USING "#",1')!;
    const statement = base.statement;
    if (statement.type !== 'PrintUsingStatement') throw new Error('Expected format');
    const supplied: ParsedLine = {
      ...base,
      statement: {
        ...statement,
        items: Array.from({length: 4097}, () => statement.items[0]),
      },
    };
    expect(() => validateProgram([supplied])).toThrow('at most 4096 values');
    expect(() => parseProgram('10 PRINT USING "##",A(0)')).toThrow('requires DIM');
    const line = parseLine('10 PRINT USING "##",A(0)')!;
    expect(validateProgram([line, parseLine('20 DIM A(0)')!]).lines).toHaveLength(2);
  });
});
