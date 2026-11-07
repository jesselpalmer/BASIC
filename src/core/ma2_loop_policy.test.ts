import {describe, expect, test} from 'bun:test';
import Basic from './runtime.ts';
import {runSelectedMa2StateProgram} from './ma2_state_program.ts';

function observed(source: string, name: string): number | string | undefined {
  return runSelectedMa2StateProgram(source).variables.find((entry) => entry.name === name)?.value;
}

describe('selected MA2 FOR/NEXT execution policy', () => {
  test('matches the six captured completion and unfinished-loop reentry cases', () => {
    expect(observed('10 FOR J=1 TO 3\n20 NEXT J\n30 END', 'J')).toBe(3);
    expect(observed('10 FOR J=3 TO 1 STEP -1\n20 NEXT J\n30 END', 'J')).toBe(1);
    expect(observed('10 FOR J=3 TO 1\n20 NEXT J\n30 END', 'J')).toBe(3);
    expect(observed('10 FOR J=1 TO 3 STEP -1\n20 NEXT J\n30 END', 'J')).toBe(1);
    const modified = '10 C=0\n20 FOR J=1 TO 3\n30 C=C+1\n40 J=J+1\n50 NEXT J\n60 END';
    expect(observed(modified, 'C')).toBe(2);
    expect(observed(modified, 'J')).toBe(4);
    const reentry =
      '10 C=0\n20 FOR J=1 TO 3\n30 C=C+1\n40 IF C=1 THEN 70\n50 NEXT J\n60 END\n70 GOTO 50';
    expect(observed(reentry, 'C')).toBe(3);
    expect(observed(reentry, 'J')).toBe(3);
  });

  test('retains native increment and loop-exit guards', () => {
    const basic = new Basic();
    basic.run('10 FOR J=1 TO 3\n20 NEXT J\n30 END');
    expect(basic.variables).toContainEqual({name: 'J', value: 4});
    expect(() => basic.run('10 FOR J=1 TO 3\n20 GOTO 40\n30 NEXT J\n40 GOTO 30')).toThrow(
      'Cannot enter inactive FOR loop',
    );
  });
});
