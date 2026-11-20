import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/fipfop-randomized-reference.json' with {type: 'json'};
import type * as PublicApi from '../src/index.ts';
import {runFipfopSourceAcceptance} from './fipfop-random-acceptance.ts';

export {fipfopRandomOptions as fipfopReviewedOptions} from './fipfop-random-acceptance.ts';
export const fipfopReviewedSource = readFileSync(
  new URL('./package/fixtures/classic/fipfop-ma2-reviewed.bas', import.meta.url),
  'utf8',
);

export async function runFipfopReviewedAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  const reviewed = readFileSync(
    new URL('./package/fixtures/classic/fipfop-mar75-text.bas', import.meta.url),
    'utf8',
  );
  assert.equal(
    createHash('sha256').update(reviewed).digest('hex'),
    reference.reviewedFixtureSha256,
  );
  assert.equal(
    createHash('sha256').update(fipfopReviewedSource).digest('hex'),
    reference.executableReviewedFixtureSha256,
  );
  assert.equal(fipfopReviewedSource, reviewed.replace('COT(Q/N+Q)', '(1/TAN(Q/N+Q))'));
  await runFipfopSourceAcceptance(api, fipfopReviewedSource);
}
