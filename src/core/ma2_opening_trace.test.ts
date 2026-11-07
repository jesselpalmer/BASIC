import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {runSelectedMa2Opening as run} from './ma2_state_program.ts';

const source = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const numbered = [
  ' 1  2   3   4   5   6   7   8',
  ' 9 10  11  12  13  14  15  16',
  '17 18  19  20  21  22  23  24',
  '25 26  27  28  29  30  31  32',
  '33 34  35  36  37  38  39  40',
  '41 42  43  44  45  46  47  48',
  '49 50  51  52  53  54  55  56',
  '57 58  59  60  61  62  63  64',
].join('\n');
const board = [
  ' 1  1  1  1  1  1  1  1 ',
  ' 1  1  1  1  1  1  1  1 ',
  ...Array.from({length: 4}, () => ' 1  1  0  0  0  0  1  1 '),
  ' 1  1  1  1  1  1  1  1 ',
  ' 1  1  1  1  1  1  1  1 ',
].join('\n');

describe('reviewed 1CHECK opening execution', () => {
  test('runs the exact 85-statement fixture to its first input with state and output', () => {
    const result = run(source);
    expect(result.status).toBe('waiting');
    expect(result.pendingInput).toMatchObject({label: 100, start: {line: 34}});
    expect(result.executed).toBe(371);
    expect(result.output).toContain(numbered + '\n');
    expect(result.output).toContain('AND HERE IS THE OPENING POSITION OF THE CHECKERS:\n\n');
    expect(result.output.endsWith(board + '\n\n')).toBe(true);
    expect(result.variables).toContainEqual({name: 'M', value: 0});
    expect(result.arrays[0].values.slice(19, 23)).toEqual([0, 0, 0, 0]);
    expect('runSelectedMa2Opening' in publicAPI).toBe(false);
  });

  test('bounds work and rejects unsupported pre-input source before output', () => {
    expect(() => run(source, 370)).toThrow('Instruction limit of 370');
    expect(() => run('10 INPUT F', 0)).toThrow('Instruction limit of 0');
    expect(() => run('10 PRINT "A"\n20 A$=B$\n30 INPUT F')).toThrow('requires numeric targets');
    expect(() => run('10 B$="Ω"\n20 INPUT F')).toThrow('character-domain');
    expect(() => run('10 PRINT B$\n20 INPUT F')).toThrow('String B$ is unbound');
    expect(() => run('10 B$="BAD"\n20 PRINT USING B$,1\n30 INPUT F')).toThrow(
      'MA2 unsupported: image',
    );
    expect(() => run('10 PRINT 1/0\n20 INPUT F')).toThrow('MA2 numeric-event: 61');
    expect(() =>
      run('10 FOR I=1 TO 15000\n20 PRINT "' + 'X'.repeat(70) + '"\n30 NEXT I\n40 END', 40_000),
    ).toThrow('Selected MA2 opening output limit reached');
  });

  test('stops at an INPUT boundary and can complete a fully supported small program', () => {
    const paused = run('10 PRINT "READY"\n20 INPUT A\n30 A$="AFTER"\n40 END');
    expect(paused).toMatchObject({status: 'waiting', pendingInput: {label: 20}, output: 'READY\n'});
    const finished = run('10 B$="##"\n20 PRINT USING B$,1\n30 END');
    expect(finished).toMatchObject({status: 'halted', pendingInput: null, output: ' 1\n'});
  });
});
