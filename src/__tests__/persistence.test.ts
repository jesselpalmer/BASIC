import {it} from 'bun:test';
import {resolve} from 'node:path';
import {checkPersistenceSessions} from '../../scripts/package/check-persistence.ts';

it('preserves programs and files across real editor sessions and failures', async () => {
  await checkPersistenceSessions(resolve(import.meta.dirname, '../../bin/basic'));
}, 20000);
