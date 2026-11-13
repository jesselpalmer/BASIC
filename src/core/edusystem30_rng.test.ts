import {expect, test} from 'bun:test';

import reference from '../../docs/edusystem30-reference.json';
import signedReference from '../../docs/edusystem30-signed-rng-reference.json';
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

test('EDUSYSTEM-30 seeded draws match the archive across sign and wrap boundaries', () => {
  const stream = new EduSystem30Random();
  for (const {clockWord, drawStatesOctal} of signedReference.observations) {
    stream.reset();
    stream.randomize(clockWord);
    const expected = drawStatesOctal.map((words) => Number.parseInt(words, 8) / 2 ** 23);
    expect(Array.from({length: expected.length}, () => stream.next())).toEqual(expected);
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

test('EDUSYSTEM-30 RND evaluates its argument and consumes the archived stream', () => {
  const expected = reference.rngState.committedStatesOctal
    .slice(0, 12)
    .map((words) => Number.parseInt(words, 8) / 2 ** 23);
  expect(reference.rng.sameSequenceForArgumentsMinus2Through9).toBe(true);
  let output = '';
  const basic = new api.Basic({write: (text) => (output += text)}, {dialect: 'edusystem-30'});
  const source = '10 FOR I=1 TO 12\n20 A=RND(I-3)\n30 PRINT A\n40 NEXT I\n50 END';
  for (let run = 0; run < 2; run++) {
    output = '';
    basic.run(source);
    expect(output.trim().split(/\s+/)).toEqual(reference.rng.printedRnd0);
    expect(basic.variables.find(({name}) => name === 'A')?.value).toBe(expected.at(-1));
  }
  output = '';
  basic.run('10 A=RND(RND(0))\n20 PRINT A\n30 END');
  expect(output.trim()).toBe(reference.rng.printedRnd0[1]);
  expect(basic.variables.find(({name}) => name === 'A')?.value).toBe(expected[1]);
  expect(() => basic.run('10 A=RND(1/0)\n20 END')).toThrow('Cannot divide by zero');
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
