import {expect, test} from '@playwright/test';
import {assertChemstOutput, chemstGame, chemstSource} from '../chemst-acceptance.ts';

test('CHEMST matches the archived successes, retry, nine losses and fresh run', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('chemst');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(chemstSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (let run = 0; run < 2; run++) {
    await page.locator('#run').click();
    for (const [index, answer] of chemstGame.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    assertChemstOutput((await output.textContent())!.replace(/\?(?:BAD|[\d.]+)\n/g, '?'));
  }
});
