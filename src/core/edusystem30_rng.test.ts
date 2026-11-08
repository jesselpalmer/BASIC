import {expect, test} from 'bun:test';

import reference from '../../docs/edusystem30-reference.json';
import {EduSystem30Random} from './edusystem30_rng.ts';

test('EDUSYSTEM-30 draws match the archived interpreter words for a full stream', () => {
  const stream = new EduSystem30Random();
  const states = reference.rngState.committedStatesOctal;
  expect(states).toHaveLength(512);
  for (const wordPair of states) {
    expect(stream.next()).toBe(Number.parseInt(wordPair, 8) / 2 ** 23);
  }
});

test('an independent RUN starts at the first draw while replay can retain the stream', () => {
  const stream = new EduSystem30Random();
  const first = stream.next();
  for (let draw = 1; draw < 5; draw++) stream.next();
  expect(new EduSystem30Random().next()).toBe(first);
  const sixth = stream.next();
  expect(Math.floor(3 * first) + 1).toBe(1);
  expect(Math.floor(3 * sixth) + 1).toBe(2);
});
