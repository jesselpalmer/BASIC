import {test, expect} from '@playwright/test';
test('INPUT LINE reads exact text into a stepped array target without a prompt', async ({page}) => {
  await page.goto('/');
  const source = '10 DIM A$(0)\n20 INPUT LINE A$(0)\n30 PRINT "[";A$(0);"]":END';
  await page.locator('#source').fill(source);
  await page.locator('#step').click();
  await expect(page.locator('#next-line')).toContainText('BASIC line 20');
  await page.locator('#step').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await expect(page.locator('#input-prompt')).toHaveText(/^$/);
  await page.locator('#input-value').fill('  a,b,"raw"  ');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Paused');
  await expect(page.locator('#next-line')).toContainText('BASIC line 30');
  await page.locator('#continue').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(/^\[ {2}a,b,"raw" {2}\]\n$/);
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText(/^\[\]\n$/);
  await expect(page.locator('#source')).toHaveValue(source);
});
test('INPUT LINE rejects dead numeric targets before effects and Stop isolates a replacement', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#source').fill('10 PRINT "never":END:INPUT LINE N');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Error');
  await expect(page.locator('#console-output')).toHaveText(/^$/);
  await expect(page.locator('#input-form')).not.toBeVisible();
  await page.locator('#source').fill('10 INPUT LINE S$:PRINT S$');
  await page.locator('#run').click();
  await expect(page.locator('#input-form')).toBeVisible();
  await page.locator('#stop').click();
  await expect(page.locator('#status')).toHaveText('Stopped');
  await page.locator('#source').fill('10 PRINT "replacement"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toHaveText('replacement\n');
});
