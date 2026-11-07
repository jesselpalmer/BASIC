import {expect, test} from 'bun:test';
import {createSelectedMa2Session} from './ma2_state_program.ts';

test('selected run rejects a late malformed image before the earlier PRINT can execute', () => {
  const source = '10 PRINT "READY"\n20 B$="## ##"\n30 PRINT USING B$,1\n40 INPUT F\n50 END';
  expect(() => createSelectedMa2Session(source)).toThrow('image/value count differs');
});

test('selected run rejects a dead later image replacement before any execution', () => {
  const source = '10 PRINT "READY"\n20 B$="##"\n30 PRINT USING B$,1\n40 END\n50 B$="##"';
  expect(() => createSelectedMa2Session(source)).toThrow('one earlier literal assignment');
});

test('selected run accepts the reviewed image and renders before INPUT', () => {
  const source = '10 B$="## ##"\n20 PRINT USING B$,1,2\n30 INPUT F\n40 END';
  expect(createSelectedMa2Session(source).advance()).toMatchObject({
    status: 'waiting',
    pendingInput: {label: 30},
    output: ' 1  2\n',
  });
});
