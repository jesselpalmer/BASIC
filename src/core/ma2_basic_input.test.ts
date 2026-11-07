import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createInternalSelectedBasic} from './runtime.ts';

const source = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const rejected = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw Error('Expected rejection');
    },
    (error: unknown) => error,
  );

test('selected first-game INPUT runs through Basic stepAsync and preserves committed F', async () => {
  const prompts: string[] = [];
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(source, {
    write: (text) => writes.push(text),
    readLine: (prompt) => {
      prompts.push(prompt ?? '');
      return Promise.resolve(prompt === 'JUMP FROM' ? '1' : '19');
    },
  });
  const nextLabel = () => basic.state.nextLocation?.label;
  while (nextLabel() !== 100) basic.step();
  expect(basic.state.nextLocation?.label).toBe(100);
  expect(() => basic.step()).toThrow('Use runAsync or stepAsync');
  expect(basic.status).toBe('error');
  basic.reset();
  while (nextLabel() !== 100) basic.step();
  await basic.stepAsync();
  while (nextLabel() !== 110) basic.step();
  expect(nextLabel()).toBe(110);
  expect(basic.variables).toContainEqual({name: 'F', value: 1});
  await basic.stepAsync();
  expect(basic.variables).toContainEqual({name: 'T', value: 19});
  expect(prompts).toEqual(['JUMP FROM', 'TO']);
  expect(writes.join('')).toContain('1');
});

test('selected input cancellation cannot commit a late response and fresh run starts clean', async () => {
  let release!: (text: string) => void;
  const late = new Promise<string>((resolve) => (release = resolve));
  let calls = 0;
  const basic = createInternalSelectedBasic('10 INPUT F\n20 PRINT F\n30 END', {
    readLine: () => (++calls === 1 ? late : Promise.resolve('2')),
  });
  const pending = basic.stepAsync();
  expect(basic.status).toBe('waiting');
  basic.cancel();
  expect(await rejected(pending)).toMatchObject({name: 'AbortError'});
  release('1');
  await Promise.resolve();
  expect(basic.variables).toEqual([]);
  expect((await basic.runAsync()).status).toBe('halted');
  expect(basic.variables).toContainEqual({name: 'F', value: 2});
});

test('selected second input errors retain source location and earlier committed response', async () => {
  const basic = createInternalSelectedBasic('10 INPUT "FROM";F\n20 INPUT "TO";T\n30 END', {
    readLine: (prompt) => (prompt === 'FROM' ? Promise.resolve('1') : Promise.resolve(null)),
  });
  await basic.stepAsync();
  expect(basic.variables).toContainEqual({name: 'F', value: 1});
  expect(basic.state.nextLocation?.label).toBe(20);
  expect(await rejected(basic.stepAsync())).toMatchObject({
    diagnostic: {code: 'INPUT_ENDED', label: 20},
  });
  expect(basic.variables).toContainEqual({name: 'F', value: 1});
  expect(basic.status).toBe('error');
});

test('reviewed 1CHECK quit and replay finish under Basic runAsync with selected A$', async () => {
  const prompts: string[] = [];
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(source, {
    write: (text) => writes.push(text),
    readLine: (prompt) => {
      prompts.push(prompt ?? '');
      return Promise.resolve(prompt === 'JUMP FROM' ? '0' : 'NO');
    },
  });
  expect((await basic.runAsync()).status).toBe('halted');
  expect(prompts).toEqual(['JUMP FROM', 'TRY AGAIN']);
  expect(basic.variables).toContainEqual({name: 'F', value: 0});
  expect(writes.join('')).toContain('YOU MADE 0 JUMPS AND HAD 48 PIECES');
  prompts.length = 0;
  expect((await basic.runAsync()).status).toBe('halted');
  expect(prompts).toEqual(['JUMP FROM', 'TRY AGAIN']);
});

test('cancelling TO retains committed FROM but cannot commit late TO into a new game', async () => {
  let release!: (text: string) => void;
  const late = new Promise<string>((resolve) => (release = resolve));
  const basic = createInternalSelectedBasic(source, {
    readLine: (prompt) => (prompt === 'JUMP FROM' ? Promise.resolve('1') : late),
  });
  const nextLabel = () => basic.state.nextLocation?.label;
  while (nextLabel() !== 100) basic.step();
  await basic.stepAsync();
  while (nextLabel() !== 110) basic.step();
  const pending = basic.stepAsync();
  expect(basic.status).toBe('waiting');
  expect(basic.variables).toContainEqual({name: 'F', value: 1});
  basic.cancel();
  expect(await rejected(pending)).toMatchObject({name: 'AbortError'});
  release('19');
  await Promise.resolve();
  expect(basic.variables).toContainEqual({name: 'F', value: 1});
  expect(basic.variables).not.toContainEqual({name: 'T', value: 19});
  basic.reset();
  expect(basic.variables).not.toContainEqual({name: 'F', value: 1});
});
