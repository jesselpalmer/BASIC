import {describe, expect, test} from 'bun:test';
import {BasicRuntimeError} from './diagnostic.ts';
import Basic from './runtime.ts';
import {createSelectedMa2Session, runSelectedMa2StateProgram} from './ma2_state_program.ts';

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

  test('retains both initialized nested frames across an unfinished exit and reentry', () => {
    // The manual permits returning to an initialized unfinished loop. This
    // selected case exercises both enclosing and inner frames without GOSUB.
    const source =
      '10 C=0\n20 FOR I=1 TO 2\n30 FOR J=1 TO 2\n40 C=C+1\n' +
      '50 IF C=1 THEN 80\n60 NEXT J\n70 NEXT I\n75 END\n80 GOTO 60';
    const result = runSelectedMa2StateProgram(source);
    expect(result.variables).toContainEqual({name: 'C', value: 4});
    expect(result.variables).toContainEqual({name: 'I', value: 2});
    expect(result.variables).toContainEqual({name: 'J', value: 2});
    expect(result.executed).toBe(20);
  });

  test('rejects a NEXT increment outside the selected signed-word domain at its source', () => {
    // This is an explicit support boundary, not an inferred historical
    // overflow result. No out-of-domain assignment or later PRINT may occur.
    for (const source of [
      '10 FOR J=32767 TO 32767\n20 NEXT J\n30 PRINT "AFTER"\n40 END',
      '10 FOR J=-32768 TO -32768 STEP -1\n20 NEXT J\n30 PRINT "AFTER"\n40 END',
    ]) {
      const session = createSelectedMa2Session(source);
      try {
        session.advance();
        throw new Error('Expected selected loop-domain failure');
      } catch (error) {
        expect(error).toBeInstanceOf(BasicRuntimeError);
        if (error instanceof BasicRuntimeError) {
          expect(error.diagnostic.code).toBe('UNSUPPORTED_MA2_LOOP_VALUE');
          expect(error.diagnostic.label).toBe(20);
        }
      }
      expect(() => session.advance()).toThrow(
        'Selected MA2 loop requires an exact signed-word integer',
      );
    }
    const native = new Basic();
    native.run('10 FOR J=32767 TO 32767\n20 NEXT J\n30 END');
    expect(native.variables).toContainEqual({name: 'J', value: 32768});
  });
});
