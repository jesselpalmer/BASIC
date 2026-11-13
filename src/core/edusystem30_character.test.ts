import {expect, test} from 'bun:test';
import assert from 'node:assert/strict';
import blackjack from '../../docs/blkjak-edusystem30-reference.json';
import golf from '../../docs/golf-edusystem30-reference.json';
import {Basic, BasicRuntimeError, parseProgram} from '../index.ts';
import {validateEduSystem30Line} from '../parser/edusystem30_support.ts';
import {maxInputResponseLength} from './input.ts';
import {decodeSourceDocument, encodeSourceDocument} from './source_document.ts';

const space = {dialect: 'edusystem-30'} as const;
const mark = {dialect: 'edusystem-30-mark'} as const;

test('EDUSYSTEM-30 character literals always compile to archived marked ASCII', () => {
  const {source, output} = golf.probes[0];
  for (const options of [space, mark]) {
    let printed = '';
    new Basic({write: (text) => (printed += text)}, options).run(source);
    expect(printed).toBe(output);
  }
  expect(() => parseProgram(source)).toThrow('Unexpected character');
  expect(() => parseProgram('10 PRINT #a\n20 END', mark)).toThrow('character literal');
});

test('EDUSYSTEM-30 character input selects parity through the portable document', async () => {
  const {source, answer, runs} = golf.characterInputParity;
  for (const options of [space, mark]) {
    let printed = '';
    const document = decodeSourceDocument(encodeSourceDocument(source, options));
    expect(document.dialect).toBe(options.dialect);
    const program = parseProgram(document.source, document);
    const basic = new Basic(
      {readLine: () => Promise.resolve(answer), write: (text) => (printed += text)},
      document,
    );
    await basic.runAsync(program);
    const expected = runs.find(({parity}) => parity === (options === mark ? 'mark' : 'space'));
    expect(printed).toBe('LETTER\n' + expected?.output);
  }
  expect(() => new Basic({}, space).reset(parseProgram(source, mark))).toThrow('conflicting');
});

test('EDUSYSTEM-30 numeric CHR$ reproduces archived conversion and PRINT adjacency', () => {
  let printed = '';
  const basic = new Basic({write: (text) => (printed += text)}, mark);
  basic.run(blackjack.characterProbe.source.join('\n'));
  expect(printed).toBe(blackjack.characterProbe.output);
  printed = '';
  basic.run('10 PRINT 1 CHR$(#A) 2\n20 END');
  expect(printed).toBe(' 1 A 2 \n');
});

test('EDUSYSTEM-30 CHR$ bounds terminal controls before emitting PRINT output', () => {
  let printed = '';
  const basic = new Basic({write: (text) => (printed += text)}, mark);
  expect(() => basic.run('10 PRINT CHR$(8)\n20 END')).toThrow('printable CHR$');
  expect(() => basic.run('10 A=1E50\n20 PRINT "PREFIX";CHR$(A)\n30 END')).toThrow(
    'printable terminal character',
  );
  expect(printed).toBe('');
});

test('EDUSYSTEM-30 indexed and scalar character INPUT share the submitted line', async () => {
  const source = [
    '10 DIM A(3)',
    '20 INPUT $A(0)',
    '30 INPUT $X',
    '40 INPUT $A(1)',
    '50 PRINT A(0);X;A(1)',
    '60 END',
  ].join('\n');
  for (const [options, expected] of [
    [space, ' 65  98  13 \n'],
    [mark, ' 193  226  141 \n'],
  ] as const) {
    let printed = '';
    let reads = 0;
    const basic = new Basic(
      {
        readLine(prompt) {
          expect(prompt).toBe('');
          return Promise.resolve(reads++ === 0 ? 'Ab' : null);
        },
        write: (text) => (printed += text),
      },
      options,
    );
    await basic.runAsync(source);
    expect(printed).toBe(expected);
    expect(reads).toBe(1);
  }
});

test('EDUSYSTEM-30 indexed character INPUT retains numeric fields and can hand off to numeric INPUT', async () => {
  const source = [
    '10 DIM A(3)',
    '20 INPUT X',
    '30 INPUT $A(0)',
    '40 INPUT Y',
    '50 INPUT Z',
    '60 PRINT X;A(0);Y;Z',
    '70 END',
  ].join('\n');
  const responses = ['42,77', 'B54'];
  const prompts: string[] = [];
  let printed = '';
  const basic = new Basic(
    {
      readLine(prompt) {
        prompts.push(prompt ?? '');
        return Promise.resolve(responses.shift() ?? null);
      },
      write: (text) => (printed += text),
    },
    mark,
  );
  await basic.runAsync(source);
  expect(prompts).toEqual(['?', '']);
  expect(printed).toBe('? 42  194  77  54 \n');
});

test('EDUSYSTEM-30 indexed character INPUT commits computed array indices and clears surplus on fresh RUN', async () => {
  const responses = ['é', 'JUNK', 'K'];
  let printed = '';
  const basic = new Basic(
    {
      readLine: () => Promise.resolve(responses.shift() ?? null),
      write: (text) => (printed += text),
    },
    mark,
  );
  const source = '10 DIM A(3,2)\n20 I=1\n30 INPUT$A(I,2)\n40 PRINT A(1,2)\n50 END';
  await basic.runAsync(source);
  expect(printed).toBe('\nEnter an ASCII line.\n 202 \n');
  printed = '';
  await basic.runAsync();
  expect(printed).toBe(' 203 \n');
  expect(responses).toEqual([]);
});

test('EDUSYSTEM-30 indexed character INPUT retains complete program array validation', () => {
  const source = '10 DIM A(3)\n20 INPUT $A(1)\n30 END';
  const program = parseProgram(source, mark);
  const parsedLine = program.lines[1];
  const {statement} = parsedLine;
  if (statement.type !== 'InputTargetsStatement') throw new Error('Expected indexed INPUT');
  expect(() =>
    validateEduSystem30Line({
      ...parsedLine,
      statement: {...statement, targets: [...statement.targets, ...statement.targets]},
    }),
  ).toThrow('unprompted indexed character INPUT');
  expect(() => parseProgram(source)).toThrow();
  expect(() => parseProgram('10 INPUT $A(1)\n20 END', mark)).toThrow('requires DIM');
  expect(() => parseProgram('10 DIM A(3)\n20 INPUT $A(1,2)\n30 END', mark)).toThrow(
    'requires 1 index(es)',
  );
  expect(() => parseProgram('10 DIM A$(3)\n20 INPUT $A$(1)\n30 END', mark)).toThrow('numeric DIM');
  expect(() => new Basic({}, space).reset(program)).toThrow('conflicting');
});

test('EDUSYSTEM-30 ignores a cancelled indexed reply after a replacement starts', async () => {
  let resolveOld!: (text: string) => void;
  let started!: () => void;
  const firstRequest = new Promise<void>((resolve) => (started = resolve));
  let reads = 0;
  let printed = '';
  const basic = new Basic(
    {
      readLine() {
        if (reads++ > 0) return Promise.resolve('B');
        started();
        return new Promise<string>((resolve) => (resolveOld = resolve));
      },
      write: (text) => (printed += text),
    },
    mark,
  );
  const source = '10 DIM A(2)\n20 INPUT $A(0)\n30 INPUT $A(1)\n40 PRINT A(0);A(1)\n50 END';
  const pending = basic.runAsync(source);
  await firstRequest;
  const replacement = basic.runAsync(source);
  resolveOld('BAD');
  await assert.rejects(pending, {name: 'AbortError'});
  await replacement;
  expect(printed).toBe(' 194  141 \n');
  expect(reads).toBe(2);
});

test('EDUSYSTEM-30 rejects an oversized indexed reply before assigning a cell', async () => {
  const basic = new Basic(
    {readLine: () => Promise.resolve('A'.repeat(maxInputResponseLength + 1))},
    mark,
  );
  const source = '10 DIM A(2)\n20 INPUT $A(0)\n30 END';
  await assert.rejects(
    basic.runAsync(source),
    (error) =>
      error instanceof BasicRuntimeError &&
      error.diagnostic.code === 'INPUT_LIMIT' &&
      error.diagnostic.label === 20,
  );
  expect(basic.arrays[0]?.values).toEqual([0, 0, 0]);
});
