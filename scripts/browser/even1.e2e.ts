import {expect, test} from '@playwright/test';
import {
  assertEven1Output,
  even1Entropy,
  even1Options,
  even1Runs,
  even1Source,
} from '../even1-acceptance.ts';

test('EVEN1 matches the archived learned moves, wins, retries and fresh RUN', async ({page}) => {
  test.setTimeout(30000);
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, even1Entropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('even1');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${even1Options.dialect}`);
  await expect(page.locator('#source')).toHaveValue(even1Source);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of even1Runs) {
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
    const transcript = (await output.textContent())!.replace(/\?(?:\d+\n|[YN])/g, '?');
    assertEven1Output(transcript, run);
  }
});
