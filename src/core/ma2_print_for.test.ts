import {describe, expect, test} from 'bun:test';
import reference from '../../docs/rsts-ma2-print-for-reference.json';
import Basic from './runtime.ts';
import {programInstructions} from './instructions.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {prepareSelectedMa2Candidate} from './prepared_program.ts';
import {parseProgram, parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import {validateProgram} from '../parser/program_validation.ts';
import {validateBasicPlusMa2Candidate} from '../parser/ma2_candidate_validation.ts';

describe('selected MA2 PRINT FOR modifier', () => {
  for (const probe of reference.probes) {
    test(`matches V4A and V4B ${probe.name} output on fresh runs`, () => {
      let output = '';
      const basic = new Basic(
        {write: (text) => (output += text)},
        {dialect: 'basic-plus-v4a12-ma2'},
      );
      basic.run(probe.source.join('\n'));
      expect(output).toBe(probe.output);
      output = '';
      basic.run();
      expect(output).toBe(probe.output);
    });
  }

  test('prepares a source-bound header, body and implicit NEXT with physical locations', () => {
    const source = '10 PRINT I;FOR I=1 TO 2:PRINT "AFTER"\r\n20 END';
    const prepared = prepareSelectedMa2Candidate(source);
    expect(prepared.instructions.map(({statement}) => statement.type)).toEqual([
      'ForStatement',
      'PrintStatement',
      'NextStatement',
      'PrintStatement',
      'EndStatement',
    ]);
    expect(prepared.labelIndices.get(10)).toBe(0);
    expect(prepared.instructions.map(({nextIndex}) => nextIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(prepared.instructions.slice(0, 4).map(({nextLineIndex}) => nextLineIndex)).toEqual([
      4, 4, 4, 4,
    ]);
    expect(
      prepared.instructions.slice(0, 3).map(({statement}) => statement.location),
    ).toMatchObject([
      {start: {line: 1, column: 12, offset: 11}, end: {column: 24}},
      {start: {line: 1, column: 4, offset: 3}, end: {column: 12}},
      {start: {line: 1, column: 16, offset: 15}, end: {column: 17}},
    ]);
    expect(prepared.loopPairs).toMatchObject([{forIndex: 0, nextIndex: 2}]);
    const supplied = structuredClone(parseBasicPlusMa2Candidate(source));
    const sequence = supplied[0].statement;
    if (sequence.type !== 'StatementSequence' || sequence.statements[0].type !== 'PrintStatement')
      throw Error('Expected modified PRINT');
    const modifier = sequence.statements[0].forModifier!;
    (modifier.bodyLocation.end as {column: number}).column++;
    expect(() => validateBasicPlusMa2Candidate(source, supplied)).toThrow(
      'disagrees with its source',
    );
  });

  test('rejects malformed modifier trees before lowering instructions', () => {
    for (const forModifier of [
      undefined,
      {},
      {header: {type: 'EndStatement'}},
      {header: {type: 'ForStatement'}},
    ]) {
      const lines = structuredClone(parseProgram('10 PRINT "NO"').lines);
      Object.assign(lines[0].statement, {forModifier});
      expect(() => programInstructions(lines, {ma2PrintModifiers: true})).toThrow(
        'Expected a PRINT FOR header and body location',
      );
    }
  });

  test('each phase is bounded by Step, instruction limits and Stop', () => {
    const source = '10 PRINT I;FOR I=1 TO 2\n20 END';
    const session = createSelectedMa2Session(source);
    expect(session.step()).toMatchObject({
      executed: 1,
      output: '',
      nextLocation: {start: {column: 4}},
    });
    expect(session.step()).toMatchObject({
      executed: 2,
      output: ' 1 ',
      nextLocation: {start: {column: 16}},
    });
    expect(session.step()).toMatchObject({
      executed: 3,
      output: ' 1 ',
      nextLocation: {start: {column: 4}},
    });
    expect(session.step()).toMatchObject({executed: 4, output: ' 1  2 '});
    expect(session.cancel()).toMatchObject({executed: 4, status: 'halted', output: ' 1  2 '});
    expect(session.advance()).toMatchObject({executed: 4, status: 'halted'});
    const limited = createSelectedMa2Session(source, 2);
    expect(limited.step().executed).toBe(1);
    expect(limited.step().executed).toBe(2);
    expect(() => limited.step()).toThrow('Instruction limit of 2 reached');
    const empty = createSelectedMa2Session(
      '10 PRINT "WRONG";FOR I=3 TO 1\n20 PRINT "AFTER"\n30 END',
    );
    expect(empty.step()).toMatchObject({executed: 1, output: '', nextLocation: {label: 20}});
  });

  test('rejects unsupported modifier placement and native source before effects', () => {
    for (const source of [
      '10 PRINT "EARLY"\n20 END\n30 IF 1=1 THEN PRINT I;FOR I=1 TO 2',
      '10 PRINT "EARLY"\n20 END\n30 PRINT I;FOR I=1 TO 2 FOR J=1 TO 2',
      '10 PRINT "EARLY"\n20 END\n30 PRINT USING "#",I FOR I=1 TO 2',
      '10 PRINT "EARLY"\n20 END\n30 A=1 FOR I=1 TO 2',
    ]) {
      let output = '';
      const basic = new Basic(
        {write: (text) => (output += text)},
        {dialect: 'basic-plus-v4a12-ma2'},
      );
      expect(() => basic.run(source)).toThrow();
      expect(output).toBe('');
    }
    for (const source of ['10 PRINT I;FOR I=1 TO 2', '10 &"NO"'])
      expect(() => parseProgram(source)).toThrow();
    for (const source of ['10 PRINT "NO"', '10 END', '10 PRINT "NO":END']) {
      const lines = structuredClone(parseProgram(source).lines);
      Object.assign(lines[0].statement, {forModifier: undefined});
      expect(() => validateProgram(lines)).toThrow();
    }
    expect(parseProgram('10 PRINT "& GO TO FOR"').lines[0].statement.type).toBe('PrintStatement');
  });
});
