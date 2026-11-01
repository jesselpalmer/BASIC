import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('PRINT USING mixes string/integer fields, preserves source and reruns from an exact export', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (d) => d.accept());
  const source = '10 PRINT USING "!!!","AB","CD","EF"\n20 PRINT USING "! ##","Ada",-2\n';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#console-output')).toHaveText(/^ACE\n$/);
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(/^ACE\nA -2\n$/);
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await downloaded).path();
  if (!path) throw new Error('Expected export');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#file-input').setInputFiles(path);
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(/^ACE\nA -2\n$/);
});
test('PRINT USING string failures write nothing and a valid rerun recovers', async ({page}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT USING "!!","A",2');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toHaveText(/^$/);
  await expect(page.locator('#diagnostic')).toContainText('must be a string');
  await page.locator('#source').fill('10 PRINT USING "!", ""');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(/^ \n$/);
});
