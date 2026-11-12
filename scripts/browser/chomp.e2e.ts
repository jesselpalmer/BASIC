import {expect, test} from '@playwright/test';
import {assertChompOutput, chompRuns, chompSource} from '../chomp-acceptance.ts';

test('CHOMP matches the printed board sequence, replay, and fresh invalid moves', async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('chomp');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(chompSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of chompRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!.replace(/\?\d+(?:,\d+)?\n/g, '?');
    assertChompOutput(transcript, run);
  }
});
