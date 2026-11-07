import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {parseBasicPlusMa2Candidate} from './parser.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

describe('internal selected MA2 candidate syntax', () => {
  test('parses all reviewed 1CHECK source lines with raw MA2 expression words', () => {
    const lines = parseBasicPlusMa2Candidate(fixture);
    expect(lines).toHaveLength(85);
    expect(lines.map((line) => line.source).join('\n')).toBe(fixture.trimEnd());
    expect(lines.find((line) => line.label === 68)?.statement).toMatchObject({
      type: 'DimStatement',
      declarations: [{bounds: [{type: 'NumberLiteral', value: 64}]}],
    });
    const using = lines.find((line) => line.label === 74)?.statement;
    expect(using?.type).toBe('PrintUsingStatement');
    if (using?.type !== 'PrintUsingStatement') throw Error('Expected USING');
    expect(using.format).toMatchObject({type: 'Variable', name: 'B$'});
    expect(using.items).toHaveLength(8);
    expect(lines.find((line) => line.label === 105)?.statement).toMatchObject({
      type: 'IfStatement',
      condition: {right: {type: 'Ma2NumberLiteral', raw: '0'}},
      target: {type: 'NumberLiteral', value: 500},
    });
    expect(Object.isFrozen(lines)).toBe(true);
    expect(Object.isFrozen(lines[0].statement)).toBe(true);
    expect('parseBasicPlusMa2Candidate' in publicAPI).toBe(false);
    expect(() =>
      publicAPI.parseProgram(fixture, {dialect: 'basic-plus-v4a12-ma2-unknown' as 'native'}),
    ).toThrow(TypeError);
  });

  test('keeps unsupported historical spellings and malformed targets source located', () => {
    for (const source of ['10 DIM A(1.5)', '10 PRINT 1E100', '10 GOTO 32768']) {
      try {
        parseBasicPlusMa2Candidate(source);
        throw new Error(`Expected rejection: ${source}`);
      } catch (error) {
        expect(error).toBeInstanceOf(BasicSyntaxError);
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic.label).toBe(10);
      }
    }
    expect(publicAPI.parseProgram('10 PRINT USING B$,1').lines[0].statement.type).toBe(
      'PrintUsingStatement',
    );
  });
});
