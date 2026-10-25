import {describe, expect, it} from 'bun:test';
import {BasicSyntaxError, parseLine, parseProgram, validateProgram} from '../index.ts';
import type {ArrayDeclaration, ParsedLine} from '../index.ts';

function declaration(source = '10 DIM A(2)'): ArrayDeclaration {
  const statement = parseLine(source)?.statement;
  if (statement?.type !== 'DimStatement') throw new Error('Expected DIM');
  return statement.declarations[0];
}

function syntax(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BasicSyntaxError);
    if (!(error instanceof BasicSyntaxError)) throw error;
    expect(error.diagnostic.code).toBe(code);
    return;
  }
  throw new Error('Expected syntax failure');
}

describe('array syntax and preflight', () => {
  it('retains exact declaration/reference source, literal spelling and physical spans', () => {
    const source = '  10 dIm board(007,2), names$(0)  ';
    const line = parseLine(source, {line: 9, offset: 80});
    expect(line?.source).toBe(source);
    const statement = line?.statement;
    if (statement?.type !== 'DimStatement') throw new Error('Expected DIM');
    expect(
      statement.declarations.map(({name, bounds}) => [name, bounds.map(({value}) => value)]),
    ).toEqual([
      ['BOARD', [7, 2]],
      ['NAMES$', [0]],
    ]);
    const bound = statement.declarations[0].bounds[0];
    expect(bound.raw).toBe('007');
    expect(bound.location.start).toEqual({line: 9, column: 16, offset: 95});
    expect(Object.isFrozen(statement.declarations[0].bounds)).toBe(true);
    const edit = parseLine('20 board(1+1,INT(2.9))=names$(0)');
    if (edit?.statement.type !== 'LetStatement' || edit.statement.target.type !== 'ArrayReference')
      throw new Error('Expected indexed assignment');
    expect(edit.statement.target.name).toBe('BOARD');
    expect(edit.statement.target.indices.map(({type}) => type)).toEqual([
      'BinaryExpression',
      'CallExpression',
    ]);
    expect(edit.statement.expression.type).toBe('ArrayReference');
    expect(edit.statement.target.nameLocation.start.column).toBe(4);
    expect(edit.statement.target.location.end.column).toBe(23);
  });

  it('accepts incomplete array edits and validates an independent completed snapshot', () => {
    const read = parseLine('10 PRINT A(2)')!;
    const dimension = parseLine('20 DIM A(2)')!;
    expect(read.statement.type).toBe('PrintStatement');
    const lines = [dimension, read];
    const program = validateProgram(lines);
    expect(program.lines.map(({label}) => label)).toEqual([10, 20]);
    expect(program.lines[0].statement).not.toBe(read.statement);
    expect(Object.isFrozen(lines)).toBe(false);
    syntax(() => validateProgram([read]), 'UNDECLARED_ARRAY');
    expect(lines).toEqual([dimension, read]);
  });

  it.each([
    '10 DIM A()',
    '10 DIM A(-1)',
    '10 DIM A(1.0)',
    '10 DIM A(.5)',
    '10 DIM A(2+3)',
    '10 DIM A(N)',
    '10 DIM A(1,)',
    '10 DIM A(1,2,3)',
    '10 DIM A(2),',
    '10 DIM ABS(2)',
    '10 DIM A[2]',
    '10 A()=1',
    '10 A(1,2,3)=1',
    '10 PRINT A(,1)',
    '10 PRINT A(1,)',
    '10 INPUT A(1)=2',
    '10 FOR A(1)=1 TO 2',
  ])('rejects malformed or unsupported syntax: %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it.each([
    ['10 DIM A(2),A(3)', 'DUPLICATE_DIM'],
    ['10 DIM a(2)\n20 END\n30 DIM A(2)', 'DUPLICATE_DIM'],
    ['10 END\n20 PRINT A(1)', 'UNDECLARED_ARRAY'],
    ['10 DIM A(2)\n20 A(1,1)=3', 'ARRAY_RANK_MISMATCH'],
    ['10 DIM A(2,2)\n20 PRINT A(1)', 'ARRAY_RANK_MISMATCH'],
    ['10 DIM A(2)\n20 PRINT A("1")', 'TYPE_MISMATCH'],
    ['10 DIM A(2),S$(1)\n20 A(S$(0))=1', 'TYPE_MISMATCH'],
    ['10 DIM A(65536)', 'ARRAY_LIMIT'],
    ['10 DIM A(99999999999999999999)', 'INVALID_DIMENSION'],
    ['10 DIM A(65535,65535)', 'ARRAY_LIMIT'],
    ['10 DIM A(65535),B(65535),C(65535),D(65535),E(0)', 'ARRAY_LIMIT'],
  ])('preflights %s as %s', (source, code) => syntax(() => parseProgram(source), code));

  it('accepts exact resource boundaries and rejects too many small declarations', () => {
    expect(parseProgram('10 DIM A(65535),B(255,255),C(65535),D(65535)').lines).toHaveLength(1);
    const names = Array.from({length: 257}, (_, i) => `A${i}(0)`);
    expect(parseProgram('10 DIM ' + names.slice(0, 256).join(',')).lines).toHaveLength(1);
    syntax(() => parseProgram('10 DIM ' + names.join(',')), 'ARRAY_LIMIT');
  });

  it('validates supplied declaration shapes rather than trusting mutable AST bounds', () => {
    const parsed = parseLine('10 DIM A(2)')!;
    const base = declaration();
    for (const bounds of [[], [base.bounds[0], base.bounds[0], base.bounds[0]]]) {
      const line: ParsedLine = {
        ...parsed,
        statement: {
          type: 'DimStatement',
          location: parsed.statement.location,
          declarations: [{...base, bounds}],
        },
      };
      syntax(() => validateProgram([line]), 'ARRAY_RANK_MISMATCH');
    }
    for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const line: ParsedLine = {
        ...parsed,
        statement: {
          type: 'DimStatement',
          location: parsed.statement.location,
          declarations: [{...base, bounds: [{...base.bounds[0], value}]}],
        },
      };
      syntax(() => validateProgram([line]), 'INVALID_DIMENSION');
    }
  });

  it('keeps array nesting bounded while accepting long flat index expressions', () => {
    const nested = (depth: number) => 'A('.repeat(depth) + '0' + ')'.repeat(depth);
    expect(parseLine(`10 PRINT ${nested(256)}`)).not.toBeNull();
    syntax(() => parseLine(`10 PRINT ${nested(257)}`), 'EXPRESSION_TOO_DEEP');
    expect(
      parseProgram('10 DIM A(6000)\n20 PRINT A(' + Array(6000).fill('1').join('+') + ')').lines,
    ).toHaveLength(2);
  });
});
