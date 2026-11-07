import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {preflightBasicPlusMa2Candidate} from '../parser/ma2_candidate_support.ts';
import {readSelectedMa2Input} from './ma2_statement_input.ts';
import {SelectedMa2StringState} from './ma2_replay_strings.ts';
import type {NodeOf} from './types.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const instructions = preflightBasicPlusMa2Candidate(fixture).instructions;
function statement(label: number) {
  const result = instructions.find((instruction) => instruction.label === label)?.statement;
  if (!result) throw Error('Missing fixture statement');
  return result;
}
function replay(label: number): NodeOf<'IfStatement'> {
  const result = statement(label);
  if (result.type !== 'IfStatement') throw Error('Expected IF');
  return result;
}
function input(): NodeOf<'InputStatement'> {
  const result = statement(562);
  if (result.type !== 'InputStatement') throw Error('Expected INPUT');
  return result;
}

describe('selected MA2 replay string state', () => {
  test('binds the source B$ image and compares fixture replay branches with blank padding', async () => {
    const state = new SelectedMa2StringState();
    const image = statement(72);
    if (image.type !== 'LetStatement') throw Error('Expected image assignment');
    state.assignLiteral(image);
    expect(state.resolve(replay(570).condition.right)).toBe('YES');
    expect(state.snapshot()).toEqual([{name: 'B$', value: '## ##  ##  ##  ##  ##  ##  ##'}]);
    for (const [answer, yes, no] of [
      ['YES', true, false],
      ['YES  ', true, false],
      ['NO', false, true],
      ['MAYBE', false, false],
      ['', false, false],
    ] as const) {
      const response = await readSelectedMa2Input(
        {readLine: () => Promise.resolve(answer)},
        input(),
        new AbortController().signal,
      );
      if (response.kind !== 'value') throw Error('Expected selected response');
      state.commitInput(input(), response);
      expect(state.compareReplay(replay(570).condition)).toBe(yes);
      expect(state.compareReplay(replay(575).condition)).toBe(no);
    }
    const prior = state.snapshot();
    expect(Object.isFrozen(prior)).toBe(true);
    expect(Object.isFrozen(prior[0])).toBe(true);
    state.reset();
    expect(state.snapshot()).toEqual([]);
    expect(prior).toContainEqual({name: 'A$', value: ''});
    expect(() => state.compareReplay(replay(570).condition)).toThrow('unbound');
    expect('SelectedMa2StringState' in publicAPI).toBe(false);
  });

  test('rejects foreign assignments, mismatched input and unsupported comparisons before writes', () => {
    const state = new SelectedMa2StringState();
    const assign = publicAPI.parseProgram('10 A$="YES"').lines[0].statement;
    if (assign.type !== 'LetStatement') throw Error('Expected LET');
    expect(() => state.assignLiteral(assign)).toThrow('literal B$');
    expect(() => state.commitInput(input(), {kind: 'value', target: 'F', value: 'YES'})).toThrow(
      'selected A$',
    );
    expect(() => state.commitInput(input(), {kind: 'value', target: 'A$', value: 'Ω'})).toThrow(
      'character-domain',
    );
    expect(state.snapshot()).toEqual([]);
    const numeric = publicAPI.parseProgram('10 IF 1=1 THEN 20\n20 END').lines[0].statement;
    if (numeric.type !== 'IfStatement') throw Error('Expected IF');
    expect(() => state.validateReplay(numeric.condition)).toThrow('A$ YES/NO');
    expect(() => state.resolve(numeric.condition.left)).toThrow('selected string');
    expect(() => state.resolve(replay(570).condition.left)).toThrow('unbound');
  });
});
