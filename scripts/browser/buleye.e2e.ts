import {expect, test} from '@playwright/test';
import {
  buleyeBrowserOpening,
  buleyeBrowserTranscript,
  buleyeOptions,
  buleyeSource,
  buleyeTurns,
} from '../buleye-acceptance.ts';

test('adapted BULEYE matches archived two-player throws, invalid entries and winner', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('buleye');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${buleyeOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(buleyeSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const promptLabel = page.locator('#input-prompt');

  await page.locator('#run').click();
  for (const {prompt, answer} of buleyeTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect(promptLabel).toHaveText(prompt || 'Program input');
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(buleyeBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(buleyeBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
