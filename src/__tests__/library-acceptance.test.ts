import {expect, it} from 'bun:test';
import {resolve} from 'node:path';
import * as api from '../index.ts';
import {libraryAcceptanceCases, runLibraryAcceptance} from '../../scripts/library-acceptance.ts';

it('passes the same public library acceptance cases used by installed ESM and CommonJS consumers', async () => {
  expect(await runLibraryAcceptance(api, resolve(import.meta.dirname, '../../examples'))).toEqual([
    ...libraryAcceptanceCases,
  ]);
});
