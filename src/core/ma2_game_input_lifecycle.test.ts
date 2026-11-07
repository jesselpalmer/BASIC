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

test('cancelled TO response cannot complete an already started game or affect a fresh one', async () => {
  const session = createSelectedMa2Session(source);
  const opening = session.advance();
  expect(opening.pendingInput?.label).toBe(100);
  const from = await session.resumeInput({readLine: () => Promise.resolve('1')}, signal);
  expect(from.pendingInput?.label).toBe(110);
  expect(from.variables).toContainEqual({name: 'F', value: 1});
  expect(from.variables).toContainEqual({name: 'M', value: 0});

  let release!: (value: string) => void;
  const late = new Promise<string>((resolve) => (release = resolve));
  const controller = new AbortController();
  const prompts: string[] = [];
  const pending = session.resumeInput(
    {readLine: (prompt) => (prompts.push(prompt ?? ''), late)},
    controller.signal,
  );
  controller.abort();
  expect(await rejection(pending)).toMatchObject({name: 'AbortError'});
  release('19');
  await Promise.resolve();
  expect(() => session.advance()).toThrow('Input cancelled');
  expect(
    await rejection(session.resumeInput({readLine: () => Promise.resolve('19')}, signal)),
  ).toMatchObject({
    message: 'Selected MA2 run has ended',
  });
  expect(prompts).toEqual(['TO']);

  const fresh = createSelectedMa2Session(source);
  const restart = fresh.advance();
  expect(restart.pendingInput?.label).toBe(100);
  expect(restart.output).toBe(opening.output);
  expect(restart.variables).toContainEqual({name: 'M', value: 0});
  expect(restart.arrays).toEqual(opening.arrays);
  expect(
    (await fresh.resumeInput({readLine: () => Promise.resolve('0')}, signal)).pendingInput?.label,
  ).toBe(562);
});

test('TO host EOF and failure carry the second source prompt location and stop the run', async () => {
  for (const [readLine, code] of [
    [() => Promise.resolve(null), 'INPUT_ENDED'],
    [() => Promise.reject(Error('host closed')), 'INPUT_FAILED'],
  ] as const) {
    const session = createSelectedMa2Session(source);
    session.advance();
    const from = await session.resumeInput({readLine: () => Promise.resolve('1')}, signal);
    expect(from.pendingInput?.label).toBe(110);
    const error = await rejection(session.resumeInput({readLine}, signal));
    expect(error).toMatchObject({diagnostic: {code, label: 110}});
    expect(() => session.advance()).toThrow();
  }
});
