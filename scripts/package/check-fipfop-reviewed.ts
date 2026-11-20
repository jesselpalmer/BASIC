import {fipfopReviewedSource} from '../fipfop-reviewed-acceptance.ts';
import {checkFipfopSourceCli} from './check-fipfop-random.ts';

export function checkFipfopReviewedCli(executable: string, directory: string): void {
  checkFipfopSourceCli(executable, directory, 'fipfop-reviewed', fipfopReviewedSource);
}
