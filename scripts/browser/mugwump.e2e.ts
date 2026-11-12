import {expect, test} from '@playwright/test';
import {
  assertMugwumpOutput,
  mugwumpEntropy,
  mugwumpOptions,
  mugwumpPrompt,
  mugwumpRuns,
  mugwumpSource,
} from '../mugwump-acceptance.ts';

test('MUGWUMP matches archived win, replay, ten-try loss and fresh RUN', async ({page}) => {
  test.setTimeout(45000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('mugwump');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${mugwumpOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(mugwumpSource);
  await page.evaluate((entropy) => {
    Math.random = () => entropy;
  }, mugwumpEntropy);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const questionCount = async () => (await output.textContent())?.split(mugwumpPrompt).length;
  for (const run of mugwumpRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect.poll(questionCount).toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect.poll(questionCount).toBe(run.answers.length + 2);
    await expect(status).toHaveText('Waiting for input');
    const transcript = (await output.textContent())!.replace(/\?\d,\d\n/g, '?');
    assertMugwumpOutput(transcript, run);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});
