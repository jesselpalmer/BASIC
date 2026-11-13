import {describe, expect, it} from 'bun:test';
import {BasicSyntaxError, parseLine, parseProgram, validateProgram} from '../index.ts';
import type {ParsedLine} from '../index.ts';

describe('EDUSYSTEM-30 CHAIN source', () => {
  it('keeps exact literals and binds names as six-character tape keys in both parity modes', () => {
    for (const dialect of ['edusystem-30', 'edusystem-30-mark'] as const) {
      const source = '10 CHAIN"DEMON"\\CHAIN "DEMON  "\\CHAIN "21INFO"\n20 END';
      const program = parseProgram(source, {dialect});
      expect(program.source).toBe(source);
      const sequence = program.lines[0].statement;
      if (sequence.type !== 'StatementSequence') throw new Error('Expected a statement sequence');
      const names = sequence.statements.map((statement) => {
        if (statement.type !== 'ChainStatement') throw new Error('Expected CHAIN');
        expect(Object.isFrozen(statement.target)).toBe(true);
        return [statement.target.value, statement.target.raw, statement.name];
      });
      expect(names).toEqual([
        ['DEMON', '"DEMON"', 'DEMON '],
        ['DEMON  ', '"DEMON  "', 'DEMON '],
        ['21INFO', '"21INFO"', '21INFO'],
      ]);
    }
  });

  it('preflights every CHAIN and points to the invalid tape name', () => {
    const dialect = 'edusystem-30';
    for (const name of ['', '      ', ' DEMON', 'DE MON', 'DEMONXYZ', 'demon', '../ABC']) {
      const source = `10 GOTO 30\n20 CHAIN "${name}"\n30 END`;
      try {
        parseProgram(source, {dialect});
      } catch (error) {
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic).toMatchObject({
          code: 'UNSUPPORTED_EDUSYSTEM30_FORM',
          label: 20,
          line: 2,
          column: 10,
        });
        continue;
      }
      throw new Error('Expected an invalid tape name');
    }
    expect(() => parseLine('10 CHAIN A$', {dialect})).toThrow('Expected a quoted program name');
    expect(() => parseLine('10 CHAIN "DEMON"+A$', {dialect})).toThrow('Unexpected token');
  });

  it('rejects CHAIN statements in native source and constructed trees while preserving the identifier', () => {
    expect(() => parseLine('10 CHAIN "DEMON"')).toThrow('Unsupported statement');
    expect(parseProgram('10 CHAIN=5\n20 PRINT CHAIN\n30 END').lines[0].statement.type).toBe(
      'LetStatement',
    );
    const selected = parseLine('10 CHAIN "DEMON"', {dialect: 'edusystem-30'});
    if (!selected) throw new Error('Expected a numbered line');
    const supplied: ParsedLine = {...selected, dialect: 'native'};
    expect(() => validateProgram([supplied])).toThrow('CHAIN requires the EDUSYSTEM-30 profile');
  });
});
