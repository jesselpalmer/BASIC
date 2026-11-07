import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {runSelectedMa2StateProgram as run} from './ma2_state_program.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

describe('selected MA2 stateful source execution', () => {
  test('executes the reviewed opening-board initialization from the actual listing', () => {
    const source = fixture
      .split('\n')
      .filter((line) => /^(68|80|82|84|86|88|90|92|94|96|500|510|520|530|999) /.test(line))
      .join('\n');
    const result = run(source);
    expect(result.status).toBe('halted');
    expect(result.variables).toContainEqual({name: 'M', value: 0});
    expect(result.variables).toContainEqual({name: 'S', value: 48});
    const board = result.arrays.find(({name}) => name === 'A')!;
    expect(board.bounds).toEqual([64]);
    // Array observations cap at 64 cells; the source's sum visits all 64 squares.
    expect(board.truncated).toBe(true);
    expect(board.values.slice(1).filter((cell) => cell === 1)).toHaveLength(47);
    expect(board.values.slice(1).filter((cell) => cell === 0)).toHaveLength(16);
    for (const start of [19, 27, 35, 43])
      expect(board.values.slice(start, start + 4)).toEqual([0, 0, 0, 0]);
    expect('runSelectedMa2StateProgram' in publicAPI).toBe(false);
  });

  test('branches and loops through the shared instruction cursor with retained MA2 values', () => {
    const result = run(
      '10 DIM A(4)\n20 FOR I=1 TO 4\n30 A(I)=I*2\n40 NEXT I\n50 IF A(4)=8 THEN 70\n60 A(1)=999\n70 GOTO 90\n80 A(1)=999\n90 END',
    );
    expect(result.arrays[0].values).toEqual([0, 2, 4, 6, 8]);
    expect(result.variables).toContainEqual({name: 'I', value: 4});
    expect(run('10 A=0\n20 IF A=1 THEN 40\n30 A=2\n40 END').variables).toContainEqual({
      name: 'A',
      value: 2,
    });
  });

  test('rejects unsupported dead source before effects and bounds busy loops', () => {
    expect(() => run('10 A=1\n20 END\n30 PRINT A')).toThrow('Selected MA2 state execution');
    expect(() => run('10 A$="X"\n20 END')).toThrow('requires numeric targets');
    expect(() => run('10 A=0\n20 GOTO 20', 3)).toThrow('Instruction limit of 3');
    expect(() => run('10 FOR I=.5 TO 2\n20 NEXT I\n30 END')).toThrow('exact signed-word integer');
    expect(() => run('10 DIM A(2)\n20 A(3)=1\n30 END')).toThrow('Index must be an integer');
    expect(() => run('10 END', -1)).toThrow(TypeError);
    expect(() => run('10 A=1/0\n20 END')).toThrow('MA2 numeric-event: 61');
    expect(() => run('10 IF 1/0=0 THEN 30\n20 END\n30 END')).toThrow('MA2 numeric-event: 61');
    expect(() => run('10 FOR I=1/0 TO 2\n20 NEXT I\n30 END')).toThrow('MA2 numeric-event: 61');
    const stringAssignment = publicAPI.parseProgram('10 A$="X"').lines[0].statement;
    if (stringAssignment.type !== 'LetStatement') throw Error('Expected assignment');
    const state = createBasicPlusMa2ArraySession();
    expect(() => state.assignNode(stringAssignment.target, stringAssignment.expression)).toThrow(
      'numeric target',
    );
  });
});
