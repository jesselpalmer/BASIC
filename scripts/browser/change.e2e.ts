import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('CHANGE steps once, round-trips bytes, reruns and preserves imported/exported source', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  const source =
    '10 DIM A(3)\n20 S$="CAT"\n30 CHANGE S$ TO A\n40 CHANGE A TO R$\n50 PRINT R$;A(0):END\n';
  await page
    .locator('#file-input')
    .setInputFiles({name: 'change.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 30');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('line 40');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('CAT3\n');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('CAT3\n');
  await expect(page.locator('#source')).toHaveValue(source);
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected exported CHANGE source');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#file-input').setInputFiles(path);
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('CAT3\n');
});

test('CHANGE reports atomic errors, rejects dead missing arrays and isolates Stop/replacement', async ({
  page,
}) => {
  await page.goto('/');
  const invalid = '10 DIM A(2):S$="too long":CHANGE S$ TO A';
  await page.locator('#source').fill(invalid);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('exceeds the array capacity');
  await expect(page.locator('#source')).toHaveValue(invalid);
  await page.locator('#source').fill('10 PRINT "never":END:CHANGE A TO S$');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toHaveText('');
  const waiting = '10 DIM A(3):INPUT S$:CHANGE S$ TO A:CHANGE A TO R$:PRINT R$';
  await page.locator('#source').fill(waiting);
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#source').fill('10 DIM A(0):CHANGE A TO S$:PRINT "empty";S$');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('empty\n');
});
