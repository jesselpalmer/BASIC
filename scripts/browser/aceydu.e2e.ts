import {expect, test} from '@playwright/test';
import {
  aceyduBrowserOpening,
  aceyduBrowserTranscript,
  aceyduOptions,
  aceyduSource,
  aceyduTurns,
} from '../aceydu-acceptance.ts';

test('ACEYDU matches the archived default deal, replay, exit and fresh RUN', async ({page}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('aceydu');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${aceyduOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(aceyduSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const promptLabel = page.locator('#input-prompt');

  await page.locator('#run').click();
  for (const {prompt, answer} of aceyduTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect(promptLabel).toHaveText(prompt);
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(aceyduBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(aceyduBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
