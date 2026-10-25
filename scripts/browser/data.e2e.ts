import {expect, test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source = readFileSync(
  new URL('../package/fixtures/data/probe.bas', import.meta.url),
  'utf8',
).replaceAll('\n', '\r\n');
const output = 'corners=1:43:4:\\AFISH\nreset=1:49\n';

test('corpus DATA literals import/export/reload exactly, and each run resets the cursor', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('#file-input')
    .setInputFiles({name: 'data.bas', mimeType: 'text/plain', buffer: Buffer.from(source)});
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  for (let run = 0; run < 2; run++) {
    await page.locator('#run').click();
    await expect(page.locator('#status')).toHaveText('Finished');
    await expect(page.locator('#console-output')).toHaveText(output);
  }
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw Error('Expected download');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(output);
});

test('Step reads a list once, preserves the cursor through INPUT/WAIT, and RESTORE rereads', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('#source')
    .fill('10 READ A,B:INPUT N:WAIT 0:READ C:RESTORE:READ D:PRINT A;B;C;D:END\n20 DATA 1,2,3');
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 13)');
  await expect(page.locator('#variables')).toContainText('A');
  await expect(page.locator('#variables')).toContainText('B');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').fill('9');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('column 21)');
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('column 28)');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('9\n1231\n');
});

test('data errors and Stop retain editable source and a replacement gets a fresh cursor', async ({
  page,
}) => {
  await page.goto('/');
  const exhausted = '10 READ A,B:PRINT "never"\n20 DATA 1';
  await page.locator('#source').fill(exhausted);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('exhausted the DATA pool');
  await expect(page.locator('#source')).toHaveValue(exhausted);
  await expect(page.locator('#console-output')).toHaveText('');
  await page.locator('#source').fill('10 READ A:PRINT A:END\n20 DATA "1"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#diagnostic')).toContainText('Expected a number');
  const waiting = '10 READ A:INPUT N:READ B:PRINT A;B:END\n20 DATA 2,3';
  await page.locator('#source').fill(waiting);
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#inspection summary').click();
  await page.locator('#source').fill('10 READ A,B:PRINT A;B:END\n20 DATA 7,8');
  await expect(page.locator('#execution-source')).toHaveText(waiting);
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('78\n');
});
