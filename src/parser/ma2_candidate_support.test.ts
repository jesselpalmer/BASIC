import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {BasicSyntaxError} from '../core/diagnostic.ts';
import {preflightBasicPlusMa2Candidate as preflight} from './ma2_candidate_support.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

describe('selected MA2 candidate statement-form preflight', () => {
  test('admits only the reviewed first-game statement forms as immutable syntax', () => {
    const candidate = preflight(fixture);
    expect(candidate.kind).toBe('ma2-candidate-syntax');
    expect(candidate.instructions).toHaveLength(85);
    expect('preflightBasicPlusMa2Candidate' in publicAPI).toBe(false);
    expect(() =>
      publicAPI.parseProgram(fixture, {dialect: 'basic-plus-v4a12-ma2' as 'native'}),
    ).toThrow(TypeError);
  });

  test('rejects unsupported forms even after END or in a dead branch', () => {
    for (const source of [
      '10 END\n20 INPUT A,B',
      '10 IF 1=0 THEN PRINT 1\n20 END',
      '10 INPUT A,B\n20 END',
    ]) {
      try {
        preflight(source);
        throw Error('Expected unsupported statement');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicSyntaxError);
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic.code).toBe('UNSUPPORTED_MA2_STATEMENT');
      }
    }
  });
});
