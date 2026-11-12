import {expect, test} from '@playwright/test';
import {
  amazinOptions,
  amazinPrompt,
  amazinRuns,
  amazinSource,
  assertAmazinOutput,
} from '../amazin-acceptance.ts';

test('AMAZIN adapts archived storage and draws both mazes with exact wall columns', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('amazin');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${amazinOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(amazinSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of amazinRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect(input).toBeVisible();
      await expect
        .poll(async () => (await output.textContent())!.split(amazinPrompt).length)
        .toBe(index + 2);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!.replace(/(LENGTH\?\n\?)\d+,\d+\n/g, '$1');
    assertAmazinOutput(transcript, run);
  }
});
