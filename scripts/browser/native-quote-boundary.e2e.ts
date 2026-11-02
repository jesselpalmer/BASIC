import {test, expect} from '@playwright/test';

test('internal historical quotes/comments stay unavailable to native browser programs', async ({
  page,
}) => {
  await page.goto('/');
  for (const source of [
    '5 PRINT "never"\n10 PRINT \'CAN\'',
    '5 PRINT "never"\n10 PRINT 1!ignored',
  ]) {
    await page.locator('#source').fill(source);
    await page.locator('#run').click();
    await expect(page.locator('#status')).toHaveText('Error');
    expect(await page.locator('#console-output').textContent()).toBe('');
    await expect(page.locator('#source')).toHaveValue(source);
    await expect(page.locator('#diagnostic')).toContainText('Unexpected character');
  }
  await page.locator('#source').fill('10 PRINT "A""B"');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Finished');
  expect(await page.locator('#console-output').textContent()).toBe('A"B\n');
});
