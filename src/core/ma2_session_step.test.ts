import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Basic from './runtime.ts';
import {BasicRuntimeError} from './diagnostic.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const reviewedSource = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

test('steps reviewed source at real instructions and resumes to the same opening INPUT', () => {
  const stepped = createSelectedMa2Session(reviewedSource);
  const first = stepped.step();
  expect(first).toMatchObject({status: 'running', executed: 1, nextLocation: {label: 10}});
  expect(first.output).toBe('\n');
  const title = stepped.step();
  expect(title).toMatchObject({status: 'running', executed: 2, nextLocation: {label: 15}});
  expect(title.output).toBe('\nSOLITAIRE CHECKER PUZZLE BY DAVID AHL\n');
  for (let count = 0; count < 14; count++) stepped.step();
  const resumed = stepped.advance();
  const continuous = createSelectedMa2Session(reviewedSource).advance();
  expect(resumed).toEqual(continuous);
  expect(resumed).toMatchObject({status: 'waiting', pendingInput: {label: 100}});
  expect(resumed.nextLocation).toMatchObject({label: 100});
});

test('one step follows selected loop and branch destinations without draining the run', () => {
  const source =
    '10 C=0\n20 FOR I=1 TO 2\n30 C=C+1\n40 NEXT I\n50 IF C=2 THEN 70\n60 PRINT "WRONG"\n70 PRINT C\n80 END';
  const session = createSelectedMa2Session(source);
  const next = [20, 30, 40, 30, 40, 50, 70, 80];
  for (let index = 0; index < next.length; index++) {
    const result = session.step();
    expect(result.status).toBe('running');
    expect(result.executed).toBe(index + 1);
    expect(result.nextLocation?.label).toBe(next[index]);
  }
  expect(session.step()).toMatchObject({status: 'halted', nextLocation: null, output: ' 2 \n'});
  expect(session.step().status).toBe('halted');

  const native = new Basic();
  expect(native.reset('10 PRINT "NATIVE"\n20 END').nextLocation?.label).toBe(10);
  expect(native.step().nextLocation?.label).toBe(20);
});

test('waiting step makes no input request and preserves instruction budget ownership', async () => {
  const session = createSelectedMa2Session('10 PRINT "READY"\n20 INPUT F\n30 PRINT F\n40 END', 4);
  expect(session.step()).toMatchObject({status: 'waiting', executed: 1, nextLocation: {label: 20}});
  expect(session.step()).toMatchObject({status: 'waiting', executed: 1, pendingInput: {label: 20}});
  const done = await session.resumeInput(
    {readLine: () => Promise.resolve('19')},
    new AbortController().signal,
  );
  expect(done).toMatchObject({status: 'halted', executed: 4, output: 'READY\n 19 \n'});
  const limited = createSelectedMa2Session('10 PRINT "READY"\n20 END', 1);
  expect(limited.step()).toMatchObject({status: 'running', executed: 1, nextLocation: {label: 20}});
  try {
    limited.step();
    throw Error('Expected instruction limit');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (error instanceof BasicRuntimeError) {
      expect(error.diagnostic.code).toBe('INSTRUCTION_LIMIT');
      expect(error.diagnostic.label).toBe(20);
    }
  }
});
