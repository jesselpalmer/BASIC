import assert from 'node:assert/strict';
import type * as PublicApi from '../src/index.ts';

type Api = Pick<
  typeof PublicApi,
  'Basic' | 'BasicRuntimeError' | 'BasicSyntaxError' | 'Evaluator' | 'parseLine'
>;

/** The supplied module is the only runtime dependency, including after installation. */
export async function runArrayAcceptance(api: Api, boardSource: string): Promise<void> {
  const answers: (string | null)[] = [];
  const output: string[] = [];
  const effects: string[] = [];
  const basic = new api.Basic({
    write: (text) => output.push(text),
    random: () => {
      effects.push('random');
      return 0.5;
    },
    readLine: () => Promise.resolve(answers.shift() ?? null),
  });
  for (let run = 0; run < 2; run++) {
    answers.push('1', '2', '1', '19', '0');
    await basic.runAsync(boardSource, {instructionLimit: 2000});
    assert.equal(basic.status, 'halted');
    assert.equal(basic.arrays[0].values[1], 0);
    assert.equal(basic.arrays[0].values[10], 0);
    assert.equal(basic.arrays[0].values[19], 1);
  }
  assert.deepEqual(output, [
    'pieces:48\n',
    'illegal\n',
    'pieces:48\n',
    'pieces:47\n',
    'moves:1\n',
    'pieces:48\n',
    'illegal\n',
    'pieces:48\n',
    'pieces:47\n',
    'moves:1\n',
  ]);
  output.length = 0;
  basic.run(
    '10 DIM M(1,2),M$(1,2)\n20 M=4\n30 DIM=5\n40 M(1,2)=7\n50 M$(0,1)="Ada"\n60 PRINT M;":";DIM;":";M(0,0);":";M(1,2);":";M$(0,1);":";M$(1,2)',
  );
  assert.deepEqual(output, ['4:5:0:7:Ada:\n']);
  const prior = basic.arrays;
  assert.ok(Object.isFrozen(prior[0].bounds));
  assert.ok(Object.isFrozen(prior[0].values));
  assert.throws(() => basic.run('1 PRINT RND()\n10 DIM A(65536)'), api.BasicSyntaxError);
  assert.deepEqual(effects, []);
  basic.run();
  assert.deepEqual(output, ['4:5:0:7:Ada:\n', '4:5:0:7:Ada:\n']);
  assert.throws(
    () => basic.run('10 DIM A(0)\n20 A(0)=8\n30 A(.5)=9'),
    (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'ARRAY_BOUNDS');
      assert.equal(error.diagnostic.label, 30);
      return true;
    },
  );
  assert.deepEqual(basic.arrays[0].values, [8]);
  assert.deepEqual(prior[0].values, [0, 0, 0, 0, 0, 7]);
  basic.reset();
  assert.deepEqual(basic.arrays[0].values, [0]);
  assert.deepEqual(new api.Basic().arrays, []);
  const dim = api.parseLine('10 DIM A(0)')?.statement;
  const write = api.parseLine('20 A(0)=9')?.statement;
  const read = api.parseLine('30 PRINT A(0)')?.statement;
  assert.ok(
    dim?.type === 'DimStatement' &&
      write?.type === 'LetStatement' &&
      read?.type === 'PrintStatement',
  );
  const evaluator = new api.Evaluator();
  evaluator.reset(dim.declarations);
  evaluator.assign(write.target, evaluator.evaluate(write.expression));
  assert.equal(evaluator.evaluate(read.items[0]), 9);
  assert.deepEqual(evaluator.snapshotVariables(), []);
  assert.deepEqual(evaluator.snapshotArrays()[0].values, [9]);
}
