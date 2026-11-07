import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseBasicPlusMa2Candidate} from '../parser/parser.ts';
import {prepareInternalSelectedProgram} from './prepared_program.ts';
import Basic, {createInternalSelectedBasic} from './runtime.ts';

const checkerSource = readFileSync(
  join(import.meta.dir, '../../scripts/package/fixtures/classic/1check-mar75-text.bas'),
  'utf8',
);

test('source-bound supplied 1CHECK Program runs through Basic async and reruns fresh', async () => {
  const supplied = structuredClone(parseBasicPlusMa2Candidate(checkerSource));
  const program = prepareInternalSelectedProgram(checkerSource, supplied);
  expect(program.source).toBe(checkerSource);
  expect(program.lines).not.toBe(supplied);
  expect(Object.isFrozen(program)).toBe(true);
  expect(Object.isFrozen(program.lines)).toBe(true);
  Reflect.set(supplied[0].statement.location.start, 'offset', 999);
  const writes: string[] = [];
  const answers = ['0', 'NO', '0', 'NO'];
  const basic = createInternalSelectedBasic(program, {
    write: (text) => writes.push(text),
    readLine: () => Promise.resolve(answers.shift() ?? null),
  });
  expect(() => basic.dialect).toThrow('no public dialect');
  expect((await basic.runAsync()).status).toBe('halted');
  const first = writes.join('');
  expect(first).toContain('AND HERE IS THE OPENING POSITION OF THE CHECKERS:');
  expect(first).toContain('YOU MADE 0 JUMPS AND HAD 48 PIECES');
  expect(basic.arrays.find(({name}) => name === 'A')?.values[19]).toBe(0);
  writes.length = 0;
  expect((await basic.runAsync()).status).toBe('halted');
  expect(writes.join('')).toBe(first);
  expect(answers).toEqual([]);
});

test('selected Program replacement is atomic, rejects altered trees and stays separate from native', () => {
  const oldSource = '10 PRINT "OLD"\n20 END';
  const old = prepareInternalSelectedProgram(oldSource, parseBasicPlusMa2Candidate(oldSource));
  const writes: string[] = [];
  const basic = createInternalSelectedBasic(old, {write: (text) => writes.push(text)});
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual(['OLD\n']);

  const badSource = '10 PRINT "BAD"\n20 INPUT Z\n30 END';
  const bad = prepareInternalSelectedProgram(badSource, parseBasicPlusMa2Candidate(badSource));
  expect(() => basic.resetInternalSelectedProgram(bad)).toThrow(
    'Selected MA2 input requires F, T or A$',
  );
  expect(basic.status).toBe('error');
  expect(writes).toEqual(['OLD\n']);
  expect(() => prepareInternalSelectedProgram(badSource, old.lines)).toThrow(
    'Supplied candidate tree disagrees with its source',
  );
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual(['OLD\n', 'OLD\n']);

  const replacementSource = '10 PRINT "NEW"\n20 END';
  const replacement = prepareInternalSelectedProgram(
    replacementSource,
    parseBasicPlusMa2Candidate(replacementSource),
  );
  expect(basic.resetInternalSelectedProgram(replacement).status).toBe('ready');
  expect(basic.run().status).toBe('halted');
  expect(writes).toEqual(['OLD\n', 'OLD\n', 'NEW\n']);
  const native = new Basic();
  expect(() => native.resetInternalSelectedProgram(replacement)).toThrow(
    'Expected an internal selected Program and execution context',
  );
  expect(native.run('10 PRINT "NATIVE"\n20 END').status).toBe('halted');
});
