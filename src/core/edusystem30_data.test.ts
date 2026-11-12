import {describe, expect, it} from 'bun:test';
import reference from '../../docs/golf-edusystem30-reference.json';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseProgram} from '../index.ts';

const options = {dialect: 'edusystem-30'} as const;

function capture() {
  const writes: string[] = [];
  const basic = new Basic({write: (text) => writes.push(text)}, options);
  return {basic, writes};
}

describe('EDUSYSTEM-30 numeric DATA and READ', () => {
  it.each([
    'numeric DATA and indexed READ',
    'DATA uses the compiled source conversion',
    'a skipped DATA statement is available',
    'DATA sequences and RESTORE',
    'marked DATA literals',
  ])('matches archived %s across fresh runs', (name) => {
    const probe = reference.probes.find((entry) => entry.name === name)!;
    const {basic, writes} = capture();
    basic.run(parseProgram(probe.source, options));
    basic.run();
    expect(writes.join('')).toBe(probe.output.repeat(2));
  });

  it('reads marked DATA from consecutive statements in the MARK dialect', () => {
    const writes: string[] = [];
    const basic = new Basic({write: (text) => writes.push(text)}, {dialect: 'edusystem-30-mark'});
    basic.run('10 DATA #N\\DATA - #Y\n20 READ A,B\n30 PRINT A;B\n40 END');
    expect(writes.join('')).toBe(' 206 -217 \n');
  });

  it('reads in label and statement order and rewinds the shared cursor', () => {
    const {basic, writes} = capture();
    basic.run(
      '70 DATA 3\\DATA 4\n10 READ A\n20 GOSUB 60\n30 RESTORE\\READ C,D\n' +
        '40 PRINT A;B;C;D\n50 GOTO 90\n60 READ B\\RETURN\n80 DATA 5\n90 END',
    );
    expect(writes.join('')).toBe(' 3  4  3  4 \n');
  });

  it.each(['+1.8', '"A"', '999999999999'])(
    'rejects unsupported DATA literal %s before effects',
    (literal) => {
      const {basic, writes} = capture();
      try {
        basic.run(`10 PRINT "EARLY"\n20 GOTO 40\n30 DATA ${literal}\n40 END`);
        throw new Error('Expected DATA admission failure');
      } catch (error) {
        if (!(error instanceof BasicSyntaxError)) throw error;
        expect(error.diagnostic).toMatchObject({
          code: 'UNSUPPORTED_EDUSYSTEM30_FORM',
          label: 30,
        });
      }
      expect(writes).toEqual([]);
    },
  );

  it('reports DATA exhaustion at the unmet target and stops before further effects', () => {
    const {basic, writes} = capture();
    try {
      basic.run('10 DATA 1\n20 READ A,B\n30 PRINT "STILL"\n40 END');
      throw new Error('Expected DATA exhaustion');
    } catch (error) {
      if (!(error instanceof BasicRuntimeError)) throw error;
      expect(error.diagnostic).toMatchObject({code: 'OUT_OF_DATA', label: 20, column: 11});
    }
    expect(basic.variables).toEqual([{name: 'A', value: 1}]);
    expect(writes).toEqual([]);
  });
});
