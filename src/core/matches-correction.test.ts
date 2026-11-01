import {test} from 'bun:test';
import * as api from '../index.ts';
import {runMatchesCorrectionAcceptance} from '../../scripts/matches-acceptance.ts';

test('reviewed 23 Matches correction preserves raw bytes and exact native retry/replay output', async () => {
  await runMatchesCorrectionAcceptance(api);
});
