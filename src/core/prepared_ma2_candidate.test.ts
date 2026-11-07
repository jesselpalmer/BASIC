import {expect, test} from 'bun:test';
import {parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';
import {prepareSelectedMa2Candidate} from './prepared_program.ts';

test('selected preparation retains exact source and detaches the supplied tree before execution', () => {
  const source = '10 PRINT "READY"\r\n20 INPUT F\r\n30 PRINT F\r\n40 END\r\n';
  const supplied = structuredClone(parseBasicPlusMa2Candidate(source));
  const prepared = prepareSelectedMa2Candidate(source, supplied);
  expect(prepared.source).toBe(source);
  expect(prepared.lines).not.toBe(supplied);
  expect(prepared.instructions.map(({label}) => label)).toEqual([10, 20, 30, 40]);
  expect(prepared.labelIndices.get(20)).toBe(1);
  expect(Object.isFrozen(prepared.lines)).toBe(true);
  expect(createSelectedMa2Session(source, 100, supplied).advance()).toMatchObject({
    status: 'waiting',
    output: 'READY\n',
    pendingInput: {label: 20},
  });
});

test('the source-bound snapshot supplies real loop indexes to selected execution', () => {
  const source = '10 FOR I=1 TO 2\n20 PRINT I;\n30 NEXT I\n40 END';
  const prepared = prepareSelectedMa2Candidate(source);
  expect(prepared.loopPairs).toHaveLength(1);
  expect(prepared.pairsByFor.get(0)?.nextIndex).toBe(2);
  expect(prepared.pairsByNext.get(2)?.forIndex).toBe(0);
  expect(createSelectedMa2Session(source).advance()).toMatchObject({
    status: 'halted',
    output: ' 1  2 ',
  });
});

test('a failed source/tree admission leaves an existing selected session runnable', async () => {
  const source = '10 PRINT "READY"\n20 INPUT F\n30 PRINT F\n40 END';
  const supplied = parseBasicPlusMa2Candidate(source);
  const session = createSelectedMa2Session(source, 100, supplied);
  expect(session.advance().pendingInput?.label).toBe(20);
  expect(() => prepareSelectedMa2Candidate(source.replace('READY', 'CHANGED'), supplied)).toThrow(
    'Supplied candidate tree disagrees with its source',
  );
  const changedDead = source + '\n50 PRINT "LATE"';
  expect(() => prepareSelectedMa2Candidate(changedDead, supplied)).toThrow(
    'Supplied candidate tree disagrees with its source',
  );
  const result = await session.resumeInput(
    {readLine: () => Promise.resolve('19')},
    new AbortController().signal,
  );
  expect(result).toMatchObject({status: 'halted', output: 'READY\n 19 \n'});
});
