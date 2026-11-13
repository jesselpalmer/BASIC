import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import reference from '../../docs/basbal-edusystem30-reference.json';
import {Basic, BasicRuntimeError} from '../index.ts';

const options = {dialect: 'edusystem-30-mark'} as const;

function openingSource(name: 'basbal' | 'basbl1'): string {
  const source = readFileSync(
    new URL(`../../scripts/package/fixtures/classic/${name}-mar75-text.bas`, import.meta.url),
    'utf8',
  );
  const normalized = source
    .split('\n')
    .map((line) =>
      line
        .replace(/^([0-9]+) CHAIN.*$/, '$1 END')
        .split(/(".*?")/)
        .map((part, index) =>
          index % 2
            ? part
            : part
                .replace(/\b(DIM|FOR|NEXT|LET|READ|DATA|PRINT|IF)(?=[A-Z.-])/g, '$1 ')
                .replace(/(?<=\d)(THEN|TO)/g, ' $1 ')
                .replace(/([A-Z])THEN(?=[0-9])/g, '$1 THEN ')
                .replace('FOR A1=ATOA-1', 'FOR A1=A TO A-1'),
        )
        .join(''),
    )
    .join('\n');
  // Reproduce only the independent opening. The earlier listing's roster has
  // no observed CHAIN handoff, and all three arrays need explicit DIM here.
  return name === 'basbl1'
    ? normalized.replace('100 DIM', '100 DIM C(19),F(19),Z(19),')
    : normalized;
}

test('EDUSYSTEM-30 BASBAL opening reads and prints one whole team name', async () => {
  const {answer, output} = reference.reviewedBasbal;
  const replies = [answer];
  let printed = '';
  const basic = new Basic(
    {
      readLine: () => Promise.resolve(replies.shift() ?? null),
      write: (text) => (printed += text),
    },
    options,
  );
  const result = await basic.runAsync(openingSource('basbal'), {instructionLimit: 2000});
  expect(result.status).toBe('halted');
  expect(result.currentLocation?.label).toBe(580);
  // The line-based host removes the typed answer and its echo; the archive's
  // capture also removed the newline attached to that echo.
  expect(printed.replace('THE \nA HIGHLY', 'THE A HIGHLY')).toBe(output);
  expect(replies).toEqual([]);
});

test('EDUSYSTEM-30 BASBL1 opening reads complete plays from successive marked bytes', async () => {
  const {answers, output} = reference.reviewedBasbl1;
  const replies = [...answers];
  let printed = '';
  const basic = new Basic(
    {
      readLine: () => Promise.resolve(replies.shift() ?? null),
      write: (text) => (printed += text),
    },
    options,
  );
  try {
    await basic.runAsync(openingSource('basbl1'), {instructionLimit: 2000});
    throw new Error('Expected an additional INPUT request');
  } catch (error) {
    expect(error).toBeInstanceOf(BasicRuntimeError);
    if (!(error instanceof BasicRuntimeError)) throw error;
    expect(error.diagnostic.code).toBe('INPUT_ENDED');
    expect(error.diagnostic.label).toBe(280);
  }
  expect(printed.replaceAll('YOUR PLAY? \n', 'YOUR PLAY? ')).toBe(output);
  expect(replies).toEqual([]);
});
