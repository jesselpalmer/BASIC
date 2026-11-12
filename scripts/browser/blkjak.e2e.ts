import {expect, test} from '@playwright/test';
import {
  assertBlkjakOutput,
  blkjakEntropy,
  blkjakOptions,
  blkjakRuns,
  blkjakSource,
} from '../blkjak-acceptance.ts';

test('BLKJAK plays the archived hands, including wager retries, replay and a fresh RUN', async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, blkjakEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('blkjak');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${blkjakOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(blkjakSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of blkjakRuns) {
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
    assertBlkjakOutput(transcript, run);
  }
});
