import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {createSelectedMa2Session} from './ma2_state_program.ts';

const fixture = readFileSync(
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

describe('selected MA2 INPUT continuation through the reviewed game', () => {
  test('runs illegal move, legal jump and quit with exact source-owned state', async () => {
    const session = createSelectedMa2Session(fixture);
    const prompts: string[] = [];
    const answers = ['1', '2', '1', '19', '0', 'MAYBE', 'YES  ', '0', 'NO'];
    const host = {
      readLine: (prompt?: string) => {
        prompts.push(prompt ?? '');
        return Promise.resolve(answers.shift() ?? null);
      },
    };
    expect(session.advance()).toMatchObject({
      status: 'waiting',
      pendingInput: {label: 100},
      executed: 371,
    });
    expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
    const illegal = await session.resumeInput(host, signal);
    expect(illegal.pendingInput?.label).toBe(100);
    expect(illegal.output.endsWith('ILLEGAL MOVE.  TRY AGAIN...\n')).toBe(true);
    expect(illegal.variables).toContainEqual({name: 'M', value: 0});
    expect(illegal.arrays[0].values.slice(1, 20)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
    ]);
    expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(110);
    const legal = await session.resumeInput(host, signal);
    expect(legal.pendingInput?.label).toBe(100);
    expect(legal.variables).toContainEqual({name: 'M', value: 1});
    expect(legal.arrays[0].values.slice(1, 20)).toEqual([
      0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(legal.output).toContain(' 0  1  1  1  1  1  1  1 \n 1  0  1');
    const quit = await session.resumeInput(host, signal);
    expect(quit).toMatchObject({status: 'waiting', pendingInput: {label: 562}});
    expect(quit.variables).toContainEqual({name: 'S', value: 47});
    expect(quit.output).toContain('YOU MADE 1 JUMPS AND HAD 47 PIECES\n');
    expect(prompts).toEqual(['JUMP FROM', 'TO', 'JUMP FROM', 'TO', 'JUMP FROM']);
    const retry = await session.resumeInput(host, signal);
    expect(retry.pendingInput?.label).toBe(562);
    expect(retry.output).toContain("PLEASE ANSWER 'YES' OR 'NO'.");
    const replay = await session.resumeInput(host, signal);
    expect(replay.pendingInput?.label).toBe(100);
    expect(replay.variables).toContainEqual({name: 'M', value: 0});
    expect(replay.arrays[0].values.slice(1, 20)).toEqual(illegal.arrays[0].values.slice(1, 20));
    expect(replay.output.match(/HERE IS THE OPENING POSITION OF THE CHECKERS:/g)).toHaveLength(2);
    expect((await session.resumeInput(host, signal)).pendingInput?.label).toBe(562);
    const done = await session.resumeInput(host, signal);
    expect(done.status).toBe('halted');
    expect(done.output).toContain('O. K.  HOPE YOU HAD FUN!');
    expect(session.advance()).toEqual(done);
    expect(await rejection(session.resumeInput(host, signal))).toMatchObject({
      message: 'Selected MA2 run has ended',
    });
    expect(prompts).toEqual([
      'JUMP FROM',
      'TO',
      'JUMP FROM',
      'TO',
      'JUMP FROM',
      'TRY AGAIN',
      'TRY AGAIN',
      'JUMP FROM',
      'TRY AGAIN',
    ]);
    expect(answers).toEqual([]);
    expect(createSelectedMa2Session(fixture).advance().variables).toContainEqual({
      name: 'M',
      value: 0,
    });
    expect('createSelectedMa2Session' in publicAPI).toBe(false);
  });

  test('keeps one pending read owned and aborts without a late commit', async () => {
    const session = createSelectedMa2Session('10 INPUT F\n20 PRINT F\n30 END');
    expect(session.advance()).toMatchObject({status: 'waiting', pendingInput: {label: 10}});
    let release!: (value: string) => void;
    const unresolved = new Promise<string>((resolve) => (release = resolve));
    const controller = new AbortController();
    const pending = session.resumeInput({readLine: () => unresolved}, controller.signal);
    expect(() => session.advance()).toThrow('input is pending');
    expect(
      await rejection(session.resumeInput({readLine: () => Promise.resolve('2')}, signal)),
    ).toMatchObject({message: 'Selected MA2 input is already pending'});
    controller.abort();
    expect(await rejection(pending)).toMatchObject({name: 'AbortError'});
    release('1');
    await Promise.resolve();
    expect(() => session.advance()).toThrow();
    expect(
      await rejection(session.resumeInput({readLine: () => Promise.resolve('2')}, signal)),
    ).toMatchObject({message: 'Selected MA2 run has ended'});
    const fresh = createSelectedMa2Session('10 INPUT F\n20 PRINT F\n30 END');
    fresh.advance();
    expect(await fresh.resumeInput({readLine: () => Promise.resolve('2')}, signal)).toMatchObject({
      status: 'halted',
      output: ' 2 \n',
    });
  });

  test('rejects unsupported input atomically and counts committed INPUT in the budget', async () => {
    const source = '10 INPUT F\n20 PRINT F\n30 END';
    const unsupported = createSelectedMa2Session(source);
    unsupported.advance();
    expect(
      await rejection(unsupported.resumeInput({readLine: () => Promise.resolve(' 1')}, signal)),
    ).toMatchObject({
      diagnostic: {code: 'UNSUPPORTED_MA2_INPUT', label: 10},
    });
    expect(() => unsupported.advance()).toThrow('numeric-response');
    const limited = createSelectedMa2Session(source, 1);
    limited.advance();
    expect(
      await rejection(limited.resumeInput({readLine: () => Promise.resolve('1')}, signal)),
    ).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT', label: 20},
    });
    const beforeInput = createSelectedMa2Session('10 PRINT "READY"\n20 INPUT F\n30 END');
    expect(
      await rejection(beforeInput.resumeInput({readLine: () => Promise.resolve('1')}, signal)),
    ).toMatchObject({message: 'Selected MA2 run is not at INPUT'});
    expect(beforeInput.advance()).toMatchObject({status: 'waiting', pendingInput: {label: 20}});
    const zero = createSelectedMa2Session(source, 0);
    expect(
      await rejection(zero.resumeInput({readLine: () => Promise.resolve('1')}, signal)),
    ).toMatchObject({
      diagnostic: {code: 'INSTRUCTION_LIMIT', label: 10},
    });
  });
});
