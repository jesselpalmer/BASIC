import {describe, expect, test} from 'bun:test';
import reference from '../../docs/ma2-data-reference.json';
import {Basic, BasicRuntimeError, parseProgram} from '../index.ts';
import {prepareSelectedMa2Candidate} from './prepared_program.ts';
import {createBasicPlusMa2ArraySession} from './evaluator.ts';
import {SelectedMa2StringState} from './ma2_replay_strings.ts';
import {SelectedMa2Data} from './ma2_statement_data.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import type {NodeOf} from './types.ts';

const options = {dialect: 'basic-plus-v4a12-ma2'} as const;

describe('selected MA2 DATA execution', () => {
  for (const probe of reference.probes.filter(
    ({name}) => !['PARTIAL', 'QUOTED', 'EMPTY'].includes(name),
  )) {
    test(`matches both archived builds for ${probe.name}, including fresh RUN`, () => {
      let output = '';
      const basic = new Basic({write: (text) => (output += text)}, options);
      basic.run(probe.source.join('\n'));
      expect(output).toBe(probe.output);
      const variables = basic.variables;
      const arrays = basic.arrays;
      output = '';
      basic.run();
      expect(output).toBe(probe.output);
      expect(basic.variables).toEqual(variables);
      expect(basic.arrays).toEqual(arrays);
    });
  }

  test('binds raw DATA decimal words without host literal rounding', () => {
    const basic = new Basic({}, options);
    basic.run('10 READ A,B\n20 END\n30 DATA 1.0000001,-1.0000001');
    expect(basic.variables).toEqual([
      {name: 'A', value: 1},
      {name: 'B', value: -1},
    ]);
  });

  test('preserves earlier READ targets and reports exhaustion at the unsatisfied target', () => {
    const basic = new Basic({}, options);
    expect(() => basic.run('10 READ A,B\n20 END\n30 DATA 7')).toThrow(BasicRuntimeError);
    expect(basic.state.diagnostic).toMatchObject({code: 'OUT_OF_DATA', label: 10, column: 11});
    expect(basic.variables).toEqual([{name: 'A', value: 7}]);
  });

  test('preserves numeric targets on quoted numeric and unsupported conversion failures', () => {
    for (const [raw, code] of [
      ['"1"', 'MA2_READ_ERROR'],
      ['9'.repeat(40), 'UNSUPPORTED_MA2_DATA'],
    ]) {
      const basic = new Basic({}, options);
      expect(() => basic.run(`10 A=7\n20 READ A\n30 END\n40 DATA ${raw}`)).toThrow();
      expect(basic.state.diagnostic).toMatchObject({code, label: 20, column: 9});
      expect(basic.variables).toEqual([{name: 'A', value: 7}]);
    }
  });

  test('consumes converted DATA before a failing array write, after earlier scalar commits', () => {
    const source = '10 READ I,A(1),J\n20 READ S$\n30 DATA 7,8,9\n40 DIM A(0)';
    const candidate = prepareSelectedMa2Candidate(source);
    const numeric = createBasicPlusMa2ArraySession(candidate.arrayDeclarations, {
      defaultNumericScalars: true,
      stringArrays: true,
    });
    const strings = new SelectedMa2StringState();
    const data = new SelectedMa2Data(candidate.lines, numeric, strings);
    const [first, second] = candidate.instructions.map(
      ({statement}) => statement,
    ) as NodeOf<'ReadStatement'>[];
    data.validateRead(first);
    expect(() => data.read(first)).toThrow('from 0 through 0');
    expect(numeric.snapshot()).toEqual([{name: 'I', value: 7}]);
    expect(numeric.snapshotArrays()[0].values).toEqual([0]);
    data.read(second);
    expect(strings.snapshot()).toEqual([{name: 'S$', value: '9'}]);
    data.restore();
    data.read(second);
    expect(strings.snapshot()).toEqual([{name: 'S$', value: '7'}]);
  });

  test('rejects unsupported READ names and indices in dead source before effects', () => {
    for (const target of ['A%', 'LONG$', 'A$("X")', 'A(SIN("X"))']) {
      let output = '';
      const basic = new Basic({write: (text) => (output += text)}, options);
      expect(() => basic.run(`10 PRINT "NEVER"\n20 END\n30 READ ${target}\n40 DATA 7`)).toThrow();
      expect(output).toBe('');
    }
  });

  test('keeps selected raw field spelling and independent source snapshots', () => {
    const source = '40 DATA  - 1 , "A, B"\r\n10 READ I,A$\r\n20 END';
    const parsed = parseProgram(source, options);
    expect(parsed.source).toBe(source);
    const data = parsed.lines.find(({label}) => label === 40)!.statement as NodeOf<'DataStatement'>;
    expect(data.items.map(({raw}) => raw)).toEqual(['  - 1 ', '"A, B"']);
    expect(data.items.map((item) => ('value' in item ? item.value : null))).toEqual(['-1', 'A, B']);
    const supplied = structuredClone(parsed);
    Object.assign(
      (supplied.lines.find(({label}) => label === 40)!.statement as NodeOf<'DataStatement'>)
        .items[0],
      {raw: '99'},
    );
    let output = '';
    const basic = new Basic({write: (text) => (output += text)}, options);
    expect(() => basic.run(supplied)).toThrow('disagrees with its source');
    expect(output).toBe('');
  });

  test('preserves the failed quoted field for a subsequent string READ', () => {
    const candidate = prepareSelectedMa2Candidate('10 READ A\n20 READ S$\n30 DATA "1",2');
    const numeric = createBasicPlusMa2ArraySession([]);
    const strings = new SelectedMa2StringState();
    const data = new SelectedMa2Data(candidate.lines, numeric, strings);
    const [first, second] = candidate.instructions.map(
      ({statement}) => statement,
    ) as NodeOf<'ReadStatement'>[];
    numeric.inject('A', 7);
    expect(() => data.read(first)).toThrow('Selected MA2 READ: 52');
    data.read(second);
    expect(numeric.snapshot()).toEqual([{name: 'A', value: 7}]);
    expect(strings.snapshot()).toEqual([{name: 'S$', value: '1'}]);
  });

  test('uses the same conversion and limits when the shared pool contains native numeric records', () => {
    const program = parseProgram('10 READ A,B$\n20 DATA - 1,+2');
    const numeric = createBasicPlusMa2ArraySession([]);
    const strings = new SelectedMa2StringState();
    const data = new SelectedMa2Data(program.lines, numeric, strings);
    data.read(program.lines[0].statement as NodeOf<'ReadStatement'>);
    expect(numeric.snapshot()).toEqual([{name: 'A', value: -1}]);
    expect(strings.snapshot()).toEqual([{name: 'B$', value: '+2'}]);
    expect(() => new SelectedMa2Data(parseProgram('10 DATA "Ω"').lines, numeric, strings)).toThrow(
      'Selected MA2 DATA',
    );
    const target = (program.lines[0].statement as NodeOf<'ReadStatement'>).targets[0];
    expect(numeric.assignWordsNode(target, [32768, 0])).toMatchObject({
      kind: 'unsupported',
      reason: 'signed-zero',
      location: target.location,
    });
    expect(numeric.snapshot()).toEqual([{name: 'A', value: -1}]);
  });

  test('steps READ and RESTORE once per statement and cancels without consuming more fields', () => {
    const session = createSelectedMa2Session(
      '10 READ A\n20 RESTORE\n30 READ B\n40 END\n50 DATA 7,8',
    );
    expect(session.step()).toMatchObject({executed: 1, variables: [{name: 'A', value: 7}]});
    expect(session.step()).toMatchObject({executed: 2, variables: [{name: 'A', value: 7}]});
    expect(session.step()).toMatchObject({
      executed: 3,
      variables: [
        {name: 'A', value: 7},
        {name: 'B', value: 7},
      ],
    });
    expect(session.cancel()).toMatchObject({status: 'halted', executed: 3});
    expect(session.advance()).toMatchObject({status: 'halted', executed: 3});
  });

  test('numeric-index events leave DATA assignment incomplete', () => {
    const basic = new Basic({}, options);
    expect(() => basic.run('10 READ I,A(1/0)\n20 END\n30 DATA 7,8')).toThrow();
    expect(basic.state.diagnostic).toMatchObject({code: 'MA2_NUMERIC_EVENT', label: 10});
    expect(basic.variables).toEqual([{name: 'I', value: 7}]);
  });
});
