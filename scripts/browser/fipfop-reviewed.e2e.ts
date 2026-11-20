import {expect, test} from '@playwright/test';
import {
  fipfopRandomBrowserOpening,
  fipfopRandomBrowserTranscript,
  fipfopRandomTurns,
} from '../fipfop-random-acceptance.ts';
import {fipfopReviewedOptions, fipfopReviewedSource} from '../fipfop-reviewed-acceptance.ts';

test('reviewed FIPFOP with reciprocal correction matches archived distinct puzzles, retries, replay and fresh RUN', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('fipfop-reviewed');
  await expect(page.locator('#document-dialect')).toHaveText(
    `Dialect: ${fipfopReviewedOptions.dialect}`,
  );
  await expect(page.locator('#source')).toHaveValue(fipfopReviewedSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');

  await page.locator('#run').click();
  for (const {precedingOutput, answer} of fipfopRandomTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect
      .poll(async () => (await output.textContent())?.endsWith(precedingOutput))
      .toBe(true);
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(fipfopRandomBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(fipfopRandomBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
