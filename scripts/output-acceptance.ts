import assert from 'node:assert/strict';
import type * as PublicApi from '../src/index.ts';

type Api = Pick<typeof PublicApi, 'Basic' | 'BasicRuntimeError'>;

/** Exact observable output, using only the direct or installed module supplied. */
export function runAdjacentPrintAcceptance(api: Api): void {
  const writes: string[] = [];
  let draws = 0;
  const basic = new api.Basic({
    write: (text) => writes.push(text),
    random: () => {
      draws++;
      return 0.25;
    },
  });
  basic.run(
    [
      '10 DIM USING(1,2),WORDS$(1)',
      '20 USING=4',
      '30 USING(1,2)=7',
      '40 USING$="word"',
      '50 B$=" b"',
      '60 WORDS$(1)="array"',
      '70 PRINT "score=" USING " / " USING(1,2) " / " (USING+1)',
      '80 PRINT "text:" USING$ B$ WORDS$(1);',
      '90 PRINT "|" 1-2',
      '100 PRINT USING B$;2',
    ].join('\n'),
  );
  assert.deepEqual(writes, ['score=4 / 7 / 5\n', 'text:word barray', '|-1\n', '4 b2\n']);
  writes.length = 0;
  assert.throws(
    () => basic.run('10 PRINT "before"\n20 PRINT "draw=" RND() ":" 1/0\n30 PRINT "must not run"'),
    (error: unknown) => {
      assert.ok(error instanceof api.BasicRuntimeError);
      assert.equal(error.diagnostic.code, 'DIVISION_BY_ZERO');
      assert.equal(error.diagnostic.label, 20);
      return true;
    },
  );
  assert.equal(draws, 1);
  assert.deepEqual(writes, ['before\n']);
  assert.equal(basic.status, 'error');
  basic.run('10 PRINT "after="1');
  assert.deepEqual(writes, ['before\n', 'after=1\n']);
}
