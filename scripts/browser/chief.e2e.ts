import {expect, test} from '@playwright/test';
import {assertChiefOutput, chiefOptions, chiefRuns, chiefSource} from '../chief-acceptance.ts';

test('CHIEF matches the archived arithmetic, lightning bolt and fresh endings', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('chief');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${chiefOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(chiefSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of chiefRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.replace('SMART, EH?', '').split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/\?[NY]\n/g, '?\n')
      .replace(/\?\d+(?:\.\d+)?\n/g, '?');
    assertChiefOutput(transcript, run);
  }
});
