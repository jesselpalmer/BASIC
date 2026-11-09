import {expect, test} from 'bun:test';

import reference from '../../docs/edusystem30-reference.json';
import letterReference from '../../docs/letter-edusystem30-reference.json';
import {runLetterAcceptance} from '../../scripts/letter-acceptance.ts';
import * as api from '../index.ts';
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

test('reviewed LETTER reproduces the archived EDUSYSTEM-30 game and replay', () =>
  runLetterAcceptance(api));

test('EDUSYSTEM-30 follows the archived backslash loop and IF paths', () => {
  let output = '';
  const basic = new api.Basic({write: (text) => (output += text)}, {dialect: 'edusystem-30'});
  basic.run(String.raw`10 FOR I=3 TO 1\PRINT "IN";I\NEXT I
20 PRINT "AFTER REVERSE LOOP"
30 IF 1=2 THEN 70\PRINT "AFTER FALSE IF"
40 PRINT "NEXT LINE"
50 FOR I=0 TO 0\PRINT "ZERO";I\NEXT I
70 END`);
  expect(output).toBe(letterReference.sequenceProbeOutput.join('\n') + '\n');
});
