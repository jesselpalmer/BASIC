import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';

const source = readFileSync(
  new URL('../package/fixtures/sequences/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const expected = 'take=4:0\nsum=9\nafter empty\ncounter=7\n1:2:done\n';

test('same-line instruction columns step independently and exact source survives export/reload', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'sequences.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText(
    'Next: BASIC line 20 (source line 2, column 4)',
  );
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('column 13)');
  await expect(page.locator('#variable-rows')).toBeEmpty();
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('column 17)');
  await expect(page.locator('#variable-rows')).toHaveText('M1');
  await expect(page.locator('#execution-source mark')).toContainText('20 DIM B(1):M=1:B(1)=4');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(expected);
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected source download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(expected);
});

test('INPUT and WAIT each step once before their same-line continuation', async ({page}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 A=1:INPUT N:WAIT 0:PRINT A+N');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 8)');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('4');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 16)');
  await expect(page.locator('#console-output')).toHaveText('4\n');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 23)');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('4\n5\n');
});

test('same-line loops pause, step and stop without losing editable source', async ({page}) => {
  await page.goto('/');
  const source = '10 FOR I=1 TO 1000000000:NEXT I:END';
  await page.locator('#source').fill(source);
  await page.locator('#run').click();
  await page.locator('#pause').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  const value = Number(await page.locator('#variable-rows td').nth(1).textContent());
  await page.locator('#step').click();
  await expect(page.locator('#variable-rows')).toHaveText(`I${value + 1}`);
  await expect(page.locator('#next-line')).toContainText(`column ${source.indexOf('NEXT') + 1})`);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#source').fill('10 PRINT "fresh":END:PRINT "never"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('fresh\n');
});

test('unreachable same-line failures validate before output and false IF skips the line', async ({
  page,
}) => {
  await page.goto('/');
  const invalid = '10 PRINT "never":END:GOTO 90';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toBeEmpty();
  await expect(page.locator('#diagnostic')).toContainText('No line label 90');
  await expect(page.locator('#source')).toHaveValue(invalid);
  await page
    .locator('#source')
    .fill('10 IF 1=0 THEN 30:PRINT "wrong"\n20 PRINT "false":GOTO 40\n30 PRINT "true"\n40 END');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('false\n');
});
