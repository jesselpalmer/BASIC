import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('trailing signs preserve exact columns through Step, export and reload', async ({page}) => {
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  const source = '10 PRINT USING "###-|**#-|!",-12,-12,"Zed"\n20 PRINT USING "##-",12\n';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#status')).toHaveText('Paused');
  expect(await page.locator('#console-output').textContent()).toBe(' 12-|*12-|Z\n');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe(' 12-|*12-|Z\n12 \n');
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
  expect(await page.locator('#console-output').textContent()).toBe(' 12-|*12-|Z\n12 \n');
});

test('a trailing sign cannot consume a digit column and overflow stays atomic', async ({page}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT USING "##-|#-",1,-12');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  expect(await page.locator('#console-output').textContent()).toBe('');
  await expect(page.locator('#diagnostic')).toContainText('does not fit its field');
  await page.locator('#source').fill('10 PRINT USING "**#-",-0');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe('**0 \n');
});
