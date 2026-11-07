import {expect, test} from 'bun:test';
import {parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const source = '10 PRINT "READY"\n20 INPUT F\n30 END\n40 PRINT 2';

test('selected execution admits an exact supplied tree without retaining it', async () => {
  const supplied = structuredClone(parseBasicPlusMa2Candidate(source));
  const session = createSelectedMa2Session(source, 100, supplied);
  const late = supplied[3].statement;
  if (late.type !== 'PrintStatement' || late.items[0].type !== 'Ma2NumberLiteral')
    throw Error('Expected dead numeric source');
  (late.items[0].words as unknown as number[])[0] ^= 1;
  (supplied[0] as {source: string}).source = '10 PRINT "CHANGED"';
  expect(session.advance()).toMatchObject({
    status: 'waiting',
    pendingInput: {label: 20},
    output: 'READY\n',
  });
  expect(
    await session.resumeInput({readLine: () => Promise.resolve('0')}, new AbortController().signal),
  ).toMatchObject({status: 'halted', output: 'READY\n'});
});

test('selected execution rejects altered source, dead words, spans and foreign metadata', () => {
  const exact = structuredClone(parseBasicPlusMa2Candidate(source));
  expect(() => createSelectedMa2Session(source + '\n50 REM X', 100, exact)).toThrow(
    'disagrees with its source',
  );
  const dead = exact[3].statement;
  if (dead.type !== 'PrintStatement' || dead.items[0].type !== 'Ma2NumberLiteral')
    throw Error('Expected dead numeric source');
  (dead.items[0].words as unknown as number[])[0] ^= 1;
  expect(() => createSelectedMa2Session(source, 100, exact)).toThrow('disagrees with its source');
  (dead.items[0].words as unknown as number[])[0] ^= 1;
  const originalColumn = dead.location.start.column;
  (dead.location.start as {column: number}).column = 99;
  expect(() => createSelectedMa2Session(source, 100, exact)).toThrow('disagrees with its source');
  (dead.location.start as {column: number}).column = originalColumn;
  const originalDialect = exact[3].dialect;
  (exact[3] as {dialect?: string}).dialect = 'basic-plus-v4a12-ma2';
  expect(() => createSelectedMa2Session(source, 100, exact)).toThrow('disagrees with its source');
  (exact[3] as {dialect?: string}).dialect = originalDialect;
  Object.setPrototypeOf(exact[3], null);
  expect(() => createSelectedMa2Session(source, 100, exact)).toThrow('disagrees with its source');
  const unsupported = '10 PRINT "READY"\n20 INPUT F\n30 END\n40 INPUT Q%';
  expect(() =>
    createSelectedMa2Session(unsupported, 100, parseBasicPlusMa2Candidate(unsupported)),
  ).toThrow('requires a short numeric or string scalar');
});
