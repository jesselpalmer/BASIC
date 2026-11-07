import {expect, test} from 'bun:test';
import {createSelectedMa2Session} from './ma2_state_program.ts';

test('selected short string scalars copy, compare with blank padding, and print', () => {
  // Independent expectation from the source and printed §5.1.5 padding rule.
  const source = [
    '10 C1$="YES "',
    '20 D$=C1$',
    '30 C1$="NO"',
    '40 IF D$="YES" THEN 60',
    '50 PRINT "BAD": END',
    '60 IF C1$<>D$ THEN 80',
    '70 PRINT "BAD": END',
    '80 PRINT "[";D$;"][";C1$;"]"',
    '90 END',
  ].join('\n');
  for (let run = 0; run < 2; run++) {
    const session = createSelectedMa2Session(source);
    const result = session.advance();
    expect(result).toMatchObject({status: 'halted', output: '[YES ][NO]\n'});
    // Reassigning C1$ cannot change the copied D$ value in output or relation.
  }
});

test('dead unsupported string expression rejects before output', () => {
  expect(() => createSelectedMa2Session('10 PRINT "READY"\n20 END\n30 C$=D$+"X"')).toThrow(
    'short string scalar or literal',
  );
});
