import {describe, expect, test} from 'bun:test';
import {createSelectedMa2Session, runSelectedMa2Opening} from './ma2_state_program.ts';

describe('selected MA2 whole-program execution preflight', () => {
  test('rejects unsupported forms after an INPUT and after END before output or input', () => {
    for (const [source, code, label] of [
      ['10 PRINT "READY"\n20 INPUT F\n30 INPUT Q%\n40 END', 'UNSUPPORTED_MA2_INPUT', 30],
      ['10 PRINT "READY"\n20 INPUT F\n30 END\n40 A$=A$+"YES"', 'UNSUPPORTED_MA2_STRING', 40],
      [
        '10 PRINT "READY"\n20 INPUT F\n30 IF A$<"MAYBE" THEN 10\n40 END',
        'UNSUPPORTED_MA2_STRING',
        30,
      ],
      ['10 PRINT "READY"\n20 INPUT F\n30 PRINT C$+"X"\n40 END', 'UNSUPPORTED_MA2_STRING', 30],
      ['10 PRINT "READY"\n20 INPUT F\n30 PRINT "Ω"\n40 END', 'UNSUPPORTED_MA2_STRING', 30],
      ['10 PRINT "READY"\n20 INPUT F\n30 PRINT USING A$,1\n40 END', 'UNSUPPORTED_MA2_STRING', 30],
      [
        '10 PRINT "READY"\n20 INPUT F\n30 PRINT USING B$,"BAD"\n40 END',
        'UNSUPPORTED_EXPRESSION',
        30,
      ],
    ] as const) {
      try {
        createSelectedMa2Session(source);
        throw Error('Expected preflight failure');
      } catch (error) {
        expect(error).toMatchObject({diagnostic: {code, label}});
      }
    }
  });

  test('retains the first-input-only preview and rejects unsupported input prompts in sessions', () => {
    const source = '10 PRINT "READY"\n20 INPUT Q%\n30 END';
    expect(runSelectedMa2Opening(source)).toMatchObject({
      status: 'waiting',
      output: 'READY\n',
      pendingInput: {label: 20},
    });
    expect(() => createSelectedMa2Session(source)).toThrow(
      'requires a short numeric or string scalar',
    );
    expect(() => createSelectedMa2Session('10 INPUT "Ω";F\n20 END')).toThrow();
  });
});
