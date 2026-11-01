import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('asterisk fields step, mix with signed/string fields and survive export/reload', async ({
  page,
}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  const source = '10 PRINT USING "**###|###|!",27,-12,"Zed"\n20 PRINT USING "**#",123\n';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  expect(await page.locator('#console-output').textContent()).toBe('***27|-12|Z\n');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe('***27|-12|Z\n123\n');
  const download = page.waitForEvent('download');
  await page.locator('#export-file').click();
  const path = await (await download).path();
  if (!path) throw new Error('Expected exported source');
  expect(readFileSync(path, 'utf8')).toBe(source);
  await page.reload();
  await page.locator('#file-input').setInputFiles(path);
  await expect(page.locator('#file-status')).toHaveText('File imported.');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe('***27|-12|Z\n123\n');
});

test('negative asterisk field writes nothing and a valid rerun recovers', async ({page}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT USING "**# **#",1,-1');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  expect(await page.locator('#console-output').textContent()).toBe('');
  await expect(page.locator('#diagnostic')).toContainText('requires a trailing sign');
  await page.locator('#source').fill('10 PRINT USING "**#",0');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe('**0\n');
});
