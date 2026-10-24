import {describe, expect, it, jest} from 'bun:test';
import {Basic, BasicRuntimeError, BasicSyntaxError, parseLine, validateProgram} from '../index.ts';
import type {Host, RunResult} from './types.ts';

function setup(host: Partial<Host> = {}) {
  const output: string[] = [];
  const basic = new Basic({write: (text) => output.push(text), ...host});
  return {basic, output};
}

// Exercise the public stepping API with a test budget so broken back edges
// cannot hang the suite before the runtime instruction-limit feature lands.
function finish(basic: Basic): RunResult {
  for (let budget = 0; budget < 2000; budget++) {
    if (basic.status === 'halted' || basic.status === 'error') return basic.state;
    basic.step();
  }
  throw new Error('Loop test exceeded its step budget');
}

function run(source: string, host: Partial<Host> = {}) {
  const result = setup(host);
  result.basic.reset(source);
  finish(result.basic);
  return result;
}

describe('FOR/NEXT values and iteration', () => {
  it.each<[string, string]>([
    ['10 FOR I=1 TO 3\n20 PRINT I\n30 NEXT I\n40 PRINT I', '1\n2\n3\n4\n'],
    ['10 FOR I=3 TO 1 STEP -1\n20 PRINT I\n30 NEXT I\n40 PRINT I', '3\n2\n1\n0\n'],
    ['10 FOR I=.5 TO 1.5 STEP .5\n20 PRINT I\n30 NEXT I\n40 PRINT I', '0.5\n1\n1.5\n2\n'],
    ['10 FOR I=3 TO 1\n20 PRINT "skipped"\n30 NEXT I\n40 PRINT I', '3\n'],
    ['10 FOR I=1 TO 3 STEP -1\n20 PRINT "skipped"\n30 NEXT I\n40 PRINT I', '1\n'],
    ['10 FOR I=2 TO 2\n20 PRINT I\n30 NEXT I\n40 PRINT I', '2\n3\n'],
    ['10 FOR I=2 TO 2 STEP -2\n20 PRINT I\n30 NEXT I\n40 PRINT I', '2\n0\n'],
    ['10 FOR I=1 TO 3\n20 NEXT I\n30 PRINT I', '4\n'],
  ])('uses inclusive bounds and retains the final variable: %s', (source, expected) => {
    const {basic, output} = run(source);
    expect(output.join('')).toBe(expected);
    expect(basic.status).toBe('halted');
  });

  it('supports nested descending loops and numeric source order', () => {
    const {output} = run(
      '60 PRINT I;":";J\n50 NEXT I\n40 NEXT J\n30 PRINT I;":";J\n20 FOR J=2 TO 1 STEP -1\n10 FOR I=1 TO 2',
    );
    expect(output).toEqual(['1:2\n', '1:1\n', '2:2\n', '2:1\n', '3:0\n']);
  });

  it('captures start/end/step once before assigning the loop variable', () => {
    expect(run('10 LET I=3\n20 FOR I=1 TO I\n30 NEXT I\n40 PRINT I').output).toEqual(['4\n']);
    const {output} = run(
      '10 LET E=3\n20 LET S=1\n30 FOR I=1 TO E STEP S\n40 LET E=0\n50 LET S=10\n60 PRINT I\n70 NEXT I\n80 PRINT I',
    );
    expect(output).toEqual(['1\n', '2\n', '3\n', '4\n']);
    const random = jest.fn(() => 0.5);
    expect(
      run('10 FOR I=INT(RND()*0)+1 TO INT(RND()*0)+2 STEP RND()+.5\n20 PRINT I\n30 NEXT I', {
        random,
      }).output,
    ).toEqual(['1\n', '2\n']);
    expect(random).toHaveBeenCalledTimes(3);
  });

  it('reads the current variable at NEXT after LET changes it', () => {
    const {output} = run('10 FOR I=1 TO 3\n20 LET I=I+1\n30 PRINT I\n40 NEXT I\n50 PRINT I');
    expect(output).toEqual(['2\n', '4\n', '5\n']);
  });

  it('reads the current variable after INPUT changes it', async () => {
    const answers = ['2', '5'];
    const {basic, output} = setup({readLine: () => Promise.resolve(answers.shift() ?? null)});
    await basic.runAsync('10 FOR I=1 TO 3\n20 INPUT I\n30 PRINT I\n40 NEXT I\n50 PRINT I');
    expect(output).toEqual(['2\n', '5\n', '6\n']);
  });

  it('steps FOR, body, and NEXT independently, including a zero-iteration skip', () => {
    const {basic, output} = setup();
    basic.reset('10 FOR I=1 TO 2\n20 PRINT I\n30 NEXT I\n40 END');
    expect(basic.step()).toMatchObject({currentLocation: {label: 10}, nextLocation: {label: 20}});
    expect(output).toEqual([]);
    basic.step();
    expect(basic.step()).toMatchObject({currentLocation: {label: 30}, nextLocation: {label: 20}});
    expect(output).toEqual(['1\n']);
    finish(basic);
    expect(output).toEqual(['1\n', '2\n']);
    basic.reset('10 FOR I=2 TO 1\n20 NEXT I');
    expect(basic.step()).toMatchObject({
      status: 'halted',
      currentLocation: {label: 10},
      nextLocation: null,
    });
  });

  it('skips the whole nested body when the outer bounds are initially false', () => {
    const {output} = run(
      '10 FOR I=2 TO 1\n20 FOR I=1 TO 3\n30 PRINT "skipped"\n40 NEXT I\n50 NEXT I\n60 PRINT I',
    );
    expect(output).toEqual(['2\n']);
  });

  it.each(['0', '-0', '1-1'])('rejects STEP %s with a BASIC source location', (step) => {
    const {basic} = setup();
    basic.reset(`10 FOR I=1 TO 2 STEP ${step}\n20 NEXT I`);
    expect(() => basic.step()).toThrow(BasicRuntimeError);
    expect(basic.state).toMatchObject({
      status: 'error',
      nextLocation: null,
      diagnostic: {code: 'ZERO_STEP', label: 10, column: 22},
    });
  });

  it.each(['10 FOR I="bad" TO 2', '10 FOR I=1 TO "bad"', '10 FOR I=1 TO 2 STEP "bad"'])(
    'rejects incompatible loop values: %s',
    (header) => {
      const {basic} = setup();
      basic.reset(header + '\n20 NEXT I');
      expect(() => basic.step()).toThrow(BasicRuntimeError);
      expect(basic.state.diagnostic).toMatchObject({code: 'TYPE_MISMATCH', label: 10});
    },
  );

  it('rejects active variable reuse when the nested header executes', () => {
    const {basic} = setup();
    basic.reset('10 FOR I=1 TO 1\n20 FOR i=1 TO 1\n30 NEXT i\n40 NEXT I');
    basic.step();
    expect(() => basic.step()).toThrow('already active');
    expect(basic.state.diagnostic).toMatchObject({
      code: 'LOOP_VARIABLE_ACTIVE',
      label: 20,
      column: 8,
    });
  });

  it('rejects increment overflow before assigning a non-finite value', () => {
    const large = '9'.repeat(308);
    const {basic} = setup();
    basic.reset(`10 FOR I=${large} TO ${large} STEP ${large}\n20 NEXT I`);
    basic.step();
    expect(() => basic.step()).toThrow('Loop increment must be finite');
    expect(basic.state.diagnostic).toMatchObject({code: 'NON_FINITE_NUMBER', label: 20, column: 9});
  });
});

describe('loop validation and syntax', () => {
  it('allows incomplete individual edits and pairs them only in full numeric program order', () => {
    const header = parseLine('10 for i=1 to 3');
    const next = parseLine('20 next I');
    if (!header || !next) throw new Error('Expected loop edits');
    expect(header.statement).toMatchObject({
      type: 'ForStatement',
      variable: {name: 'I'},
      step: null,
    });
    const candidate = structuredClone([header]);
    expect(() => validateProgram(candidate)).toThrow('no matching NEXT');
    expect(Object.isFrozen(candidate[0])).toBe(false);
    const program = validateProgram([next, ...candidate]);
    expect(program.lines.map(({label}) => label)).toEqual([10, 20]);
    expect(Object.isFrozen(program.lines[0].statement)).toBe(true);
  });

  it.each<[string, string]>([
    ['10 FOR I=1 TO 2', 'MISSING_NEXT'],
    ['10 NEXT I', 'UNMATCHED_NEXT'],
    ['10 FOR I=1 TO 2\n20 NEXT J', 'MISMATCHED_NEXT'],
    ['10 FOR I=1 TO 2\n20 FOR J=1 TO 2\n30 NEXT I\n40 NEXT J', 'MISMATCHED_NEXT'],
  ])('checks all loop structures before effects: %s', (source, code) => {
    const {basic, output} = setup();
    expect(() => basic.reset('1 PRINT "must not print"\n2 END\n' + source)).toThrow(
      BasicSyntaxError,
    );
    expect(output).toEqual([]);
    expect(basic.state.diagnostic?.code).toBe(code);
  });

  it('retains physical locations after sorting loop structures', () => {
    const {basic} = setup();
    expect(() => basic.reset('30 NEXT J\r\n10 FOR I=1 TO 2')).toThrow('Expected NEXT I, got J');
    expect(basic.state.diagnostic).toMatchObject({label: 30, line: 1, column: 9, offset: 8});
    const header = parseLine('\t20 FOR I=-(1+2) TO 3 STEP .5', {line: 8, offset: 100});
    expect(header?.statement).toMatchObject({
      type: 'ForStatement',
      step: {type: 'NumberLiteral', value: 0.5},
      location: {start: {line: 8, column: 5, offset: 104}},
    });
  });

  it.each([
    '10 FOR',
    '10 FOR 1=1 TO 2',
    '10 FOR I$=1 TO 2',
    '10 FOR I 1 TO 2',
    '10 FOR I= TO 2',
    '10 FOR I=1',
    '10 FOR I=1 TO',
    '10 FOR I=1 TO 2 STEP',
    '10 NEXT',
    '10 NEXT I$',
    '10 NEXT I,J',
    '10 NEXT I J',
  ])('rejects invalid loop syntax: %s', (source) => {
    expect(() => parseLine(source)).toThrow(BasicSyntaxError);
  });

  it.each(['10 FOR I=1 TO 2', '10 NEXT I'])(
    'rejects loop execution through the immediate adapter: %s',
    (source) => {
      const {basic} = setup();
      expect(() => basic.readLine(source)).toThrow('require a complete program');
      expect(basic.state.diagnostic?.code).toBe('PROGRAM_REQUIRED');
    },
  );
});

describe('jumps across loop boundaries', () => {
  it.each(['30', '40'])(
    'rejects a jump into an inactive body or its NEXT at label %s',
    (target) => {
      const {basic, output} = setup();
      basic.reset(`10 GOTO ${target}\n20 FOR I=1 TO 2\n30 PRINT "must not run"\n40 NEXT I\n50 END`);
      expect(() => basic.step()).toThrow('Cannot enter inactive FOR loop for I');
      expect(basic.state.diagnostic).toMatchObject({code: 'LOOP_ENTRY', label: 10, column: 9});
      expect(output).toEqual([]);
    },
  );

  it('requires an active outer frame when jumping to a nested FOR header', () => {
    const {basic} = setup();
    basic.reset('10 GOTO 40\n20 FOR I=1 TO 1\n30 REM\n40 FOR J=1 TO 1\n50 NEXT J\n60 NEXT I');
    expect(() => basic.step()).toThrow('inactive FOR loop for I');
  });

  it('rejects jumping into an inactive inner body from an active outer body', () => {
    const {basic} = setup();
    basic.reset(
      '10 FOR I=1 TO 1\n20 GOTO 40\n30 FOR J=1 TO 1\n40 PRINT "bad"\n50 NEXT J\n60 NEXT I',
    );
    basic.step();
    expect(() => basic.step()).toThrow('inactive FOR loop for J');
  });

  it('discards an exited frame so jumping back into its body fails', () => {
    const {basic, output} = setup();
    basic.reset('10 FOR I=1 TO 2\n20 GOTO 50\n30 PRINT "bad"\n40 NEXT I\n50 GOTO 30');
    basic.step();
    basic.step();
    expect(() => basic.step()).toThrow('inactive FOR loop for I');
    expect(basic.state.diagnostic?.label).toBe(50);
    expect(output).toEqual([]);
  });

  it('allows a new loop to reuse a variable after a jump exits the old loop', () => {
    const {output} = run(
      '10 FOR I=1 TO 2\n20 GOTO 50\n30 NEXT I\n50 FOR I=5 TO 6\n60 PRINT I\n70 NEXT I',
    );
    expect(output).toEqual(['5\n', '6\n']);
  });

  it('discards only the inner frame when jumping to the outer NEXT', () => {
    const {output} = run(
      '10 FOR I=1 TO 2\n20 FOR J=1 TO 3\n30 PRINT I;":";J\n40 GOTO 70\n50 NEXT J\n60 REM\n70 NEXT I\n80 PRINT I;":";J',
    );
    expect(output).toEqual(['1:1\n', '2:1\n', '3:1\n']);
  });

  it('re-enters a FOR header with fresh bounds instead of retaining its frame', () => {
    const {output} = run(
      '10 LET C=0\n20 FOR I=1 TO 1\n30 LET C=C+1\n40 IF C<2 THEN 20\n50 PRINT I;":";C\n60 NEXT I\n70 PRINT I',
    );
    expect(output).toEqual(['1:2\n', '2\n']);
  });

  it('drops inner and outer frames when re-entering the outer FOR header', () => {
    const {output} = run(
      '10 LET C=0\n20 FOR I=1 TO 1\n30 FOR J=1 TO 1\n40 LET C=C+1\n50 IF C<2 THEN 20\n60 PRINT C\n70 NEXT J\n80 NEXT I',
    );
    expect(output).toEqual(['2\n']);
  });

  it('preserves the outer frame when re-entering an inner FOR header', () => {
    const {output} = run(
      '10 LET C=0\n20 FOR I=1 TO 1\n30 FOR J=1 TO 1\n40 LET C=C+1\n50 IF C<2 THEN 30\n60 NEXT J\n70 NEXT I\n80 PRINT I;":";J;":";C',
    );
    expect(output).toEqual(['2:2:2\n']);
  });

  it('permits jumps within an active body without incrementing the loop variable', () => {
    const {output} = run(
      '10 LET C=0\n20 FOR I=1 TO 1\n30 LET C=C+1\n40 IF C<2 THEN 30\n50 PRINT I;":";C\n60 NEXT I',
    );
    expect(output).toEqual(['1:2\n']);
  });
});

describe('loop lifecycle', () => {
  it('keeps independent instances isolated and permits reset after cancellation', () => {
    const first = setup();
    const second = setup();
    const program = '10 FOR I=1 TO 2\n20 PRINT I\n30 NEXT I';
    first.basic.reset(program);
    second.basic.reset(program);
    first.basic.step();
    second.basic.step();
    first.basic.cancel();
    finish(second.basic);
    expect(second.output).toEqual(['1\n', '2\n']);
    first.basic.reset();
    finish(first.basic);
    expect(first.output).toEqual(['1\n', '2\n']);
  });

  it('halts at END inside a loop and recovers from a body failure on a new run', () => {
    expect(
      run('10 FOR I=1 TO 2\n20 PRINT I\n30 END\n40 NEXT I\n50 PRINT "skipped"').output,
    ).toEqual(['1\n']);
    const {basic, output} = setup();
    basic.reset('10 FOR I=1 TO 2\n20 PRINT MISSING\n30 NEXT I');
    basic.step();
    expect(() => basic.step()).toThrow('Undefined variable');
    expect(basic.step().status).toBe('error');
    basic.reset('10 FOR I=1 TO 1\n20 PRINT I\n30 NEXT I');
    finish(basic);
    expect(output).toEqual(['1\n']);
  });

  it('does not let old input callbacks clear or change a replacement loop frame', async () => {
    let reply!: (value: string | null) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const {basic, output} = setup({
      readLine() {
        started();
        return new Promise((resolve) => {
          reply = resolve;
        });
      },
    });
    const old = basic
      .runAsync('10 FOR I=1 TO 1\n20 INPUT N\n30 NEXT I')
      .catch((error: unknown) => error);
    await ready;
    basic.reset('100 FOR I=1 TO 1\n110 PRINT I\n120 NEXT I');
    basic.step();
    reply('99');
    expect(await old).toMatchObject({name: 'AbortError'});
    finish(basic);
    expect(output).toEqual(['1\n']);
  });
});
