import {expect, test} from 'bun:test';
import {Basic, BasicRuntimeError} from '../index.ts';
import type {RunOptions, VariableSnapshot} from '../index.ts';

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected rejection');
}

test('public runtime snapshots and synchronous statement gates retain execution semantics', async () => {
  const basic = new Basic();
  const seen: {label: number | null | undefined; variables: readonly VariableSnapshot[]}[] = [];
  const options: RunOptions = {
    beforeStatement: () => {
      seen.push({label: basic.state.nextLocation?.label, variables: basic.variables});
    },
  };
  await basic.runAsync('40 END\n10 LET N = 2\n20 GOTO 40\n30 LET N = 99', options);
  expect(seen.map(({label}) => label)).toEqual([10, 20, 40]);
  expect(seen[0].variables).toEqual([]);
  expect(seen[1].variables).toEqual([{name: 'N', value: 2}]);
  expect(basic.variables).toEqual([{name: 'N', value: 2}]);
  basic.reset();
  expect(basic.variables).toEqual([]);
  expect(seen[1].variables).toEqual([{name: 'N', value: 2}]);
});

test('empty programs and exhausted budgets never enter a statement gate', async () => {
  const basic = new Basic();
  let calls = 0;
  const beforeStatement = () => {
    calls++;
  };
  await basic.runAsync('', {beforeStatement});
  expect(
    await rejected(basic.runAsync('10 END', {beforeStatement, instructionLimit: 0})),
  ).toMatchObject({diagnostic: {code: 'INSTRUCTION_LIMIT'}});
  expect(calls).toBe(0);
});

test('invalid gates reject before replacing a prepared or active execution', async () => {
  const basic = new Basic();
  basic.run('10 LET N = 4');
  const prior = basic.state;
  expect(
    await rejected(basic.runAsync('20 END', {beforeStatement: 3} as unknown as RunOptions)),
  ).toMatchObject({message: 'beforeStatement must be a function'});
  expect(basic.state).toEqual(prior);
  expect(basic.variables).toEqual([{name: 'N', value: 4}]);
});

test.each([false, true])(
  'gate failures are located at the blocked statement (async=%s)',
  async (asyncFailure) => {
    const basic = new Basic();
    const cause = new Error('broken debugger');
    let observed: unknown;
    try {
      await basic.runAsync('10 REM first\n20 END', {
        beforeStatement: () => {
          if (basic.state.nextLocation?.label === 10) return;
          if (asyncFailure) return Promise.reject(cause);
          throw cause;
        },
      });
    } catch (error) {
      observed = error;
    }
    expect(observed).toBeInstanceOf(BasicRuntimeError);
    expect(observed).toMatchObject({
      cause,
      diagnostic: {code: 'STATEMENT_GATE_FAILED', line: 2, label: 20},
    });
    expect(basic.state).toMatchObject({status: 'error', currentLocation: {label: 20}});
  },
);

test('a suspended gate owns advancement and ignores late rejection after replacement', async () => {
  const output: string[] = [];
  const basic = new Basic({write: (text) => output.push(text)});
  let rejectGate!: (cause: unknown) => void;
  const old = basic.runAsync('10 PRINT "old"', {
    beforeStatement: () =>
      new Promise<void>((_resolve, reject) => {
        rejectGate = reject;
      }),
  });
  expect(() => basic.step()).toThrow('An async run is active');
  await basic.runAsync('10 LET N = 8\n20 PRINT N');
  expect(await rejected(old)).toMatchObject({name: 'AbortError'});
  rejectGate(new Error('late failure'));
  await Promise.resolve();
  expect(output).toEqual(['8\n']);
  expect(basic.variables).toEqual([{name: 'N', value: 8}]);
});

test('external abort releases an ignored gate and synchronous cancellation consumes its returned rejection', async () => {
  const basic = new Basic();
  const controller = new AbortController();
  const old = basic.runAsync('10 END', {
    signal: controller.signal,
    beforeStatement: () => new Promise<void>(() => {}),
  });
  controller.abort();
  expect(await rejected(old)).toMatchObject({name: 'AbortError'});
  expect(basic.status).toBe('halted');
  expect(
    await rejected(
      basic.runAsync('10 END', {
        beforeStatement: () => {
          basic.cancel();
          return Promise.reject(new Error('late cancelled hook'));
        },
      }),
    ),
  ).toMatchObject({name: 'AbortError'});
  expect(
    await rejected(
      basic.runAsync('10 END', {
        beforeStatement: () => {
          basic.cancel();
        },
      }),
    ),
  ).toMatchObject({name: 'AbortError'});
});
