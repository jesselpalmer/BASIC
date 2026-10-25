import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const raw = readFileSync(new URL('../package/fixtures/classic/1check-raw.bas', import.meta.url));
const corrected = readFileSync(
  new URL('../package/fixtures/classic/1check-corrected.bas', import.meta.url),
);

test('reviewed 1CHECK correction plays illegal/legal moves, retries, replays and exits with exact native boards', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: '1check-corrected.bas', mimeType: 'text/plain', buffer: corrected});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  const inputs = [
    ['1', 'JUMP FROM? '],
    ['2', 'TO? '],
    ['1', 'JUMP FROM? '],
    ['19', 'TO? '],
    ['0', 'JUMP FROM? '],
    ['MAYBE', 'TRY AGAIN? '],
    ['YES', 'TRY AGAIN? '],
    ['0', 'JUMP FROM? '],
    ['NO', 'TRY AGAIN? '],
  ];
  for (const [answer, prompt] of inputs) {
    await expect(page.locator('#status')).toHaveText('Waiting for input');
    await expect(page.locator('#input-prompt')).toHaveText(prompt);
    await page.locator('#input-value').fill(answer);
    await page.locator('#input-value').press('Enter');
  }
  await expect(page.locator('#status')).toHaveText('Finished');
  const text = (await page.locator('#console-output').textContent()) ?? '';
  const lines = text.split('\n');
  expect(lines.filter((line) => /^[01]{8}$/.test(line))).toEqual([
    '11111111',
    '11111111',
    '11000011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
    '01111111',
    '10111111',
    '11100011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
    '11111111',
    '11111111',
    '11000011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
  ]);
  const numberedBlock =
    [
      ' 1  2   3   4   5   6   7   8',
      ' 9 10  11  12  13  14  15  16',
      '17 18  19  20  21  22  23  24',
      '25 26  27  28  29  30  31  32',
      '33 34  35  36  37  38  39  40',
      '41 42  43  44  45  46  47  48',
      '49 50  51  52  53  54  55  56',
      '57 58  59  60  61  62  63  64',
    ].join('\n') + '\n';
  expect(text.split(numberedBlock).length - 1).toBe(2);
  expect(lines.filter((line) => line === 'ILLEGAL MOVE.  TRY AGAIN...')).toHaveLength(1);
  expect(lines.filter((line) => line === "PLEASE ANSWER 'YES' OR 'NO'.")).toHaveLength(1);
  expect(text).toContain('YOU MADE1JUMPS AND HAD47PIECES');
  expect(text).toContain('YOU MADE0JUMPS AND HAD48PIECES');
  expect(text.endsWith('O.K.  HOPE YOU HAD FUN!\n')).toBe(true);
  await page
    .locator('#file-input')
    .setInputFiles({name: '1check-raw.bas', mimeType: 'text/plain', buffer: raw});
  await expect(page.locator('#file-status')).toContainText(
    'Expected , after the PRINT USING template',
  );
  await expect(page.locator('#source')).toHaveValue(corrected.toString());
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected downloaded game');
  expect(readFileSync(path)).toEqual(corrected);
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(corrected.toString());
  await page.locator('#run').click();
  await expect(page.locator('#input-prompt')).toHaveText('JUMP FROM? ');
  const restarted = (await page.locator('#console-output').textContent()) ?? '';
  expect(restarted.split('\n').filter((line) => /^[01]{8}$/.test(line))).toEqual([
    '11111111',
    '11111111',
    '11000011',
    '11000011',
    '11000011',
    '11000011',
    '11111111',
    '11111111',
  ]);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(corrected.toString());
});
