import {expect, test} from 'bun:test';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {createInternalSelectedBasic} from './runtime.ts';

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

test('selected short string INPUT commits into shared comparison and PRINT execution', async () => {
  const prompts: string[] = [];
  const writes: string[] = [];
  const source = [
    '10 INPUT "NAME";Q$',
    '20 IF Q$="ADA " THEN 40',
    '30 PRINT "BAD": END',
    '40 PRINT "[";Q$;"]"',
    '50 END',
  ].join('\n');
  const basic = createInternalSelectedBasic(source, {
    readLine: (prompt) => (prompts.push(prompt ?? ''), Promise.resolve('ADA')),
    write: (text) => writes.push(text),
  });
  expect((await basic.runAsync()).status).toBe('halted');
  expect(prompts).toEqual(['NAME']);
  expect(writes.join('')).toBe('[ADA]\n');
});
