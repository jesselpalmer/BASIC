import {expect, test} from '@playwright/test';
import {
  baglesBrowserOpening,
  baglesBrowserTranscript,
  baglesOptions,
  baglesSource,
  baglesTurns,
} from '../bagles-acceptance.ts';

test('BAGLES matches archived invalid guesses, win, replay and loss', async ({page}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('bagles');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${baglesOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(baglesSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const promptLabel = page.locator('#input-prompt');

  await page.locator('#run').click();
  for (const {prompt, answer} of baglesTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect(promptLabel).toHaveText(prompt || 'Program input');
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(baglesBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(baglesBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
