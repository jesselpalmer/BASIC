import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as publicAPI from '../index.ts';
import {preflightBasicPlusMa2Candidate} from '../parser/ma2_candidate_support.ts';
import {observeMa2Value} from './ma2_value.ts';
import {readSelectedMa2Input as read} from './ma2_statement_input.ts';
import type {NodeOf} from './types.ts';

const fixture = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);
const statements = preflightBasicPlusMa2Candidate(fixture).instructions;
function input(label: number): NodeOf<'InputStatement'> {
  const statement = statements.find((line) => line.label === label)?.statement;
  if (statement?.type !== 'InputStatement') throw Error('Expected fixture INPUT');
  return statement;
}
async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw Error('Expected rejection');
  } catch (error) {
    return error;
  }
}

describe('selected bounded scalar input response boundary', () => {
  test('reads source prompts and converted MA2 numbers without committing state', async () => {
    const received: string[] = [];
    for (const [label, response, expected] of [
      [100, '0', 0],
      [100, '1', 1],
      [110, '19', 19],
      [110, '64', 64],
      [110, '65', 65],
      [110, '-1.5', -1.5],
      [110, '+1E2', 100],
      [110, '01', 1],
    ] as const) {
      const result = await read(
        {readLine: (prompt) => (received.push(prompt ?? ''), Promise.resolve(response))},
        input(label),
        new AbortController().signal,
      );
      expect(result.kind).toBe('value');
      if (result.kind !== 'value' || typeof result.value === 'string') throw Error('Expected MA2');
      expect(observeMa2Value(result.value)).toEqual({kind: 'value', value: expected});
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(received).toEqual(['JUMP FROM', 'JUMP FROM', 'TO', 'TO', 'TO', 'TO', 'TO', 'TO']);
    expect('readSelectedMa2Input' in publicAPI).toBe(false);
  });

  test('retains raw replay text, including invalid answer for program-controlled retry', async () => {
    for (const response of ['YES', 'NO', 'MAYBE', 'YES  ', '']) {
      const result = await read(
        {readLine: () => Promise.resolve(response)},
        input(562),
        new AbortController().signal,
      );
      expect(result).toEqual({kind: 'value', target: 'A$', value: response});
    }
    expect(
      await read({readLine: () => Promise.resolve('é')}, input(562), new AbortController().signal),
    ).toEqual({kind: 'unsupported', reason: 'string-response'});
    expect(
      await read(
        {readLine: () => Promise.resolve('x'.repeat(256))},
        input(562),
        new AbortController().signal,
      ),
    ).toEqual({kind: 'unsupported', reason: 'string-response'});
  });

  test('leaves unsettled scanner rows, conversion statuses and targets explicit', async () => {
    for (const response of [' 1', '1 ', '1e2', '1.2.3', '', '1E39', '0E32768', 'x'.repeat(256)])
      expect(
        await read(
          {readLine: () => Promise.resolve(response)},
          input(100),
          new AbortController().signal,
        ),
      ).toEqual({kind: 'unsupported', reason: 'numeric-response'});
    for (const response of ['1,2', '"1"'])
      expect(
        await read(
          {readLine: () => Promise.resolve(response)},
          input(100),
          new AbortController().signal,
        ),
      ).toEqual({kind: 'unsupported', reason: 'row'});
    expect(
      await read(
        {readLine: () => Promise.resolve('9'.repeat(40))},
        input(100),
        new AbortController().signal,
      ),
    ).toEqual({kind: 'unsupported', reason: 'numeric-event'});
    const other = publicAPI.parseProgram('10 INPUT "X";LONG').lines[0].statement;
    if (other.type !== 'InputStatement') throw Error('Expected INPUT');
    let called = false;
    expect(
      await read(
        {readLine: () => ((called = true), Promise.resolve('1'))},
        other,
        new AbortController().signal,
      ),
    ).toEqual({kind: 'unsupported', reason: 'target'});
    expect(called).toBe(false);
    const selected = publicAPI.parseProgram('10 INPUT "NAME";Q$').lines[0].statement;
    if (selected.type !== 'InputStatement') throw Error('Expected INPUT');
    expect(
      await read({readLine: () => Promise.resolve('ADA')}, selected, new AbortController().signal),
    ).toEqual({kind: 'value', target: 'Q$', value: 'ADA'});
    expect(
      await read(
        {readLine: () => Promise.resolve('ADA,LOVELACE')},
        selected,
        new AbortController().signal,
      ),
    ).toEqual({kind: 'unsupported', reason: 'row'});
  });

  test('locates EOF, host failures, invalid results and aborts without late values', async () => {
    const statement = input(100);
    const signal = new AbortController().signal;
    for (const readLine of [
      () => Promise.resolve(null),
      () => Promise.resolve(1 as unknown as string),
    ]) {
      expect(await failure(read({readLine}, statement, signal))).toMatchObject({
        diagnostic: {label: 100, line: 34},
      });
    }
    expect(
      await failure(
        read(
          {
            readLine: () => Promise.reject(Error('broken')),
          },
          statement,
          signal,
        ),
      ),
    ).toMatchObject({diagnostic: {code: 'INPUT_FAILED', label: 100}});

    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => (release = resolve));
    const controller = new AbortController();
    const operation = read({readLine: () => pending}, statement, controller.signal);
    controller.abort();
    expect(await failure(operation)).toMatchObject({name: 'AbortError'});
    release('19');
    await Promise.resolve();
    const already = new AbortController();
    already.abort();
    expect(
      await failure(read({readLine: () => Promise.resolve('19')}, statement, already.signal)),
    ).toMatchObject({name: 'AbortError'});
  });
});
