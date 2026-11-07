import {expect, test} from '@playwright/test';

test('editable 1CHECK runs in the public selected profile and retains its portable context', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('checker');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: basic-plus-v4a12-ma2');
  await expect(page.locator('#source')).toHaveValue(/SOLITAIRE CHECKER PUZZLE/);
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('OPENING POSITION OF THE CHECKERS');
  await page.locator('#input-value').fill('1');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('19');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await page.locator('#input-value').fill('0');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 1 JUMPS AND HAD 47 PIECES');
  await page.locator('#input-value').fill('NO');
  await page.locator('#input-value').press('Enter');
  await expect(page.locator('#status')).toHaveText('Finished');
  await expect(page.locator('#console-output')).toContainText('YOU MADE 1 JUMPS AND HAD 47 PIECES');

  const original = await page.locator('#source').inputValue();
  await page
    .locator('#source')
    .fill(original.replace('SOLITAIRE CHECKER PUZZLE', 'CHECKER TEST COPY'));
  await expect(page.locator('#example')).toHaveValue('');
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Waiting for input');
  await expect(page.locator('#console-output')).toContainText('CHECKER TEST COPY');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: basic-plus-v4a12-ma2');
});
