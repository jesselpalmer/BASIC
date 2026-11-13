import {expect, test} from 'bun:test';

import reference from '../../docs/horses-edu30-transfer-reference.json';
import {Basic} from '../index.ts';

test.each(reference.probes)('EDUSYSTEM-30 matches archived $name', ({source, output}) => {
  const writes: string[] = [];
  new Basic({write: (text) => writes.push(text)}, {dialect: 'edusystem-30'}).run(source);
  expect(writes.join('')).toBe(output);
});
