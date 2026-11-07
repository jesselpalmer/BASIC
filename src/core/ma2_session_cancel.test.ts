import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const source = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const signal = new AbortController().signal;
const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw Error('Expected rejection');
    },
    (error: unknown) => error,
  );

test('cancels between real selected instructions without executing the next source line', () => {
  const session = createSelectedMa2Session(source);
  const first = session.step();
  expect(first).toMatchObject({status: 'running', executed: 1, nextLocation: {label: 10}});
  const stopped = session.cancel();
  expect(stopped).toMatchObject({status: 'halted', executed: 1, nextLocation: null});
  expect(stopped.output).toBe(first.output);
  expect(stopped.arrays).toEqual(first.arrays);
  expect(session.step()).toEqual(stopped);
  expect(session.advance()).toEqual(stopped);
  expect(session.cancel()).toEqual(stopped);
  expect(createSelectedMa2Session(source).advance().pendingInput?.label).toBe(100);

  const waiting = createSelectedMa2Session(source);
  expect(waiting.advance().pendingInput?.label).toBe(100);
  expect(waiting.cancel()).toMatchObject({status: 'halted', nextLocation: null});
  expect(waiting.advance().status).toBe('halted');
});

test('cancelled pending TO cannot commit a late response or resume the old game', async () => {
  const session = createSelectedMa2Session(source);
  const opening = session.advance();
  expect(opening.pendingInput?.label).toBe(100);
  const from = await session.resumeInput({readLine: () => Promise.resolve('1')}, signal);
  expect(from).toMatchObject({status: 'waiting', pendingInput: {label: 110}});
  expect(from.variables).toContainEqual({name: 'F', value: 1});

  let release!: (value: string) => void;
  const late = new Promise<string>((resolve) => (release = resolve));
  let hostSignal: AbortSignal | undefined;
  const pending = session.resumeInput(
    {readLine: (_prompt, options) => ((hostSignal = options?.signal), late)},
    signal,
  );
  expect(hostSignal?.aborted).toBe(false);
  const stopped = session.cancel();
  expect(hostSignal?.aborted).toBe(true);
  expect(stopped).toMatchObject({status: 'halted', executed: from.executed, nextLocation: null});
  expect(stopped.output).toBe(from.output);
  expect(stopped.arrays).toEqual(from.arrays);
  expect(stopped.variables).toEqual(from.variables);
  expect(session.advance()).toEqual(stopped);
  expect(
    await rejection(session.resumeInput({readLine: () => Promise.resolve('19')}, signal)),
  ).toMatchObject({message: 'Selected MA2 run has ended'});
  expect(await rejection(pending)).toMatchObject({name: 'AbortError'});
  release('19');
  await Promise.resolve();
  expect(session.advance()).toEqual(stopped);
  expect(
    await rejection(session.resumeInput({readLine: () => Promise.resolve('19')}, signal)),
  ).toMatchObject({message: 'Selected MA2 run has ended'});

  const fresh = createSelectedMa2Session(source).advance();
  expect(fresh.output).toBe(opening.output);
  expect(fresh.arrays).toEqual(opening.arrays);
  expect(fresh.variables).toContainEqual({name: 'M', value: 0});
});
