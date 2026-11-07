import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {selectedMa2CandidateImages} from './ma2_using_image.ts';
import {formatPrintUsing} from './print_using.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

describe('source-bound selected MA2 PRINT USING image', () => {
  test('retains the reviewed fixture image and eight numbered fields', () => {
    const images = selectedMa2CandidateImages(fixture);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      variable: 'B$',
      image: '## ##  ##  ##  ##  ##  ##  ##',
      fieldCount: 8,
      location: {label: 74, start: {line: 19}},
    });
    expect(formatPrintUsing(images[0].image, [1, 2, 3, 4, 5, 6, 7, 8], images[0].location)).toBe(
      ' 1  2   3   4   5   6   7   8',
    );
    expect(Object.isFrozen(images)).toBe(true);
    expect(Object.isFrozen(images[0])).toBe(true);
    expect('selectedMa2CandidateImages' in publicAPI).toBe(false);
  });

  test.each([
    '10 PRINT USING B$,1,2\n20 B$="## ##"',
    '10 B$="## ##"\n20 B$="## ##"\n30 PRINT USING B$,1,2',
    '10 B$="## ##"\n20 INPUT B$\n30 PRINT USING B$,1,2',
    '10 B$="## ##"\n20 INPUT A$,B$\n30 PRINT USING B$,1,2',
    '10 PRINT USING "##",1',
    '10 B$="## ##"\n20 PRINT USING B$,1',
    '10 B$="##.##"\n20 PRINT USING B$,1',
    '10 B$=A$\n20 PRINT USING B$,1,2',
  ])('rejects unbound, changed or unsupported images before effects', (source) => {
    expect(() => selectedMa2CandidateImages(source)).toThrow();
  });
});
