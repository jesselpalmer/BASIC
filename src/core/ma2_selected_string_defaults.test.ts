import {expect, test} from 'bun:test';
import {BasicRuntimeError} from './diagnostic.ts';
import Basic from './runtime.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';

test('selected unassigned string reads are empty through comparison and PRINT', () => {
  // BASIC-PLUS manual §§2.5.2, 3.6.2, 5.1.2; this is only the selected short
  // scalar subset, not a string-array or public-profile claim.
  const source = '10 IF C1$="YES" THEN 40\n20 PRINT "[";D$;"]"\n30 INPUT F\n40 END';
  for (let run = 0; run < 2; run++) {
    const session = createSelectedMa2Session(source);
    const waiting = session.advance();
    expect(waiting).toMatchObject({status: 'waiting', output: '[]\n', pendingInput: {label: 30}});
    expect(waiting.variables).toEqual([]);
    expect(session.cancel().output).toBe('[]\n');
  }
});

test('empty string defaults cannot become unbound PRINT USING images', () => {
  expect(() => createSelectedMa2Session('10 PRINT USING B$,1\n20 END')).toThrow(
    'requires one earlier literal assignment',
  );
  try {
    new Basic().run('10 PRINT B$\n20 END');
    throw new Error('Expected native undefined-variable failure');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    expect(error).toMatchObject({diagnostic: {code: 'UNDEFINED_VARIABLE', label: 10}});
  }
});
