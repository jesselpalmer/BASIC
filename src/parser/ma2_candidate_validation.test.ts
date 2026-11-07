import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import type {ParsedLine} from '../core/types.ts';
import {parseBasicPlusMa2Candidate} from './parser.ts';
import {validateBasicPlusMa2Candidate as validate} from './ma2_candidate_validation.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
function diagnostic(source: string) {
  try {
    validate(source);
    throw Error('Expected a candidate error');
  } catch (error) {
    if (!(error instanceof BasicSyntaxError)) throw error;
    return error.diagnostic;
  }
}

describe('internal complete MA2 candidate syntax validation', () => {
  test('validates all reviewed 1CHECK lines and detaches the complete snapshot', () => {
    const supplied = structuredClone(parseBasicPlusMa2Candidate(fixture));
    const prepared = validate(fixture, supplied);
    expect(prepared.kind).toBe('ma2-candidate-syntax');
    expect(prepared.lines).toHaveLength(85);
    expect(prepared.instructions).toHaveLength(85);
    expect(prepared.source).toBe(fixture);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.instructions[0])).toBe(true);
    (supplied[0] as unknown as {source: string}).source = '5 END';
    expect(prepared.lines[0].source).toBe('5 PRINT');
    expect('validateBasicPlusMa2Candidate' in publicAPI).toBe(false);
    expect(() => publicAPI.validateProgram(prepared.lines)).toThrow(BasicSyntaxError);
  });

  test('checks duplicate and dead targets, paired loops and declarations before effects', () => {
    expect(diagnostic('10 END\n10 PRINT 1')).toMatchObject({code: 'DUPLICATE_LABEL', label: 10});
    expect(diagnostic('10 END\n20 GOTO 30')).toMatchObject({
      code: 'MISSING_TARGET',
      label: 20,
      line: 2,
    });
    expect(diagnostic('10 FOR I=1 TO 2\n20 END').code).toBe('MISSING_NEXT');
    expect(diagnostic('10 DIM A(1)\n20 END\n30 PRINT B(0,1)').code).toBe(
      'UNSUPPORTED_MA2_ARRAY_DEFAULT',
    );
    expect(validate('10 IF 1=1 THEN PRINT "ok"\n20 END').instructions).toHaveLength(3);
  });

  test('rejects altered raw words, locations, descendants and foreign trees', () => {
    const source = '10 PRINT 1\n20 END';
    const original: ParsedLine[] = [...structuredClone(parseBasicPlusMa2Candidate(source))];
    expect(validate(source, original).lines).toHaveLength(2);
    const literal = original[0].statement;
    if (literal.type !== 'PrintStatement' || literal.items[0].type !== 'Ma2NumberLiteral')
      throw Error('Expected MA2 print literal');
    const words = literal.items[0].words as unknown as number[];
    words[0] ^= 1;
    expect(() => validate(source, original)).toThrow('disagrees with its source');
    words[0] ^= 1;
    (literal.items[0].location.start as {column: number}).column = 99;
    expect(() => validate(source, original)).toThrow('disagrees with its source');
    (literal.items[0].location.start as {column: number}).column = 10;
    original.push(structuredClone(original[0]));
    expect(() => validate(source, original)).toThrow('disagrees with its source');
    const foreign = structuredClone(parseBasicPlusMa2Candidate(source));
    Object.setPrototypeOf(foreign[0], null);
    expect(() => validate(source, foreign)).toThrow('disagrees with its source');
  });
});
