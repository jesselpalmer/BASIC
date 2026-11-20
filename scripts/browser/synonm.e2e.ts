import {expect, test} from '@playwright/test';
import {
  synonmBrowserOpening,
  synonmBrowserTranscript,
  synonmOptions,
  synonmSource,
  synonmTurns,
} from '../synonm-acceptance.ts';

test('adapted SYNONM matches archived ten-word drill, retries and HELP', async ({page}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('synonm');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${synonmOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(synonmSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const promptLabel = page.locator('#input-prompt');

  await page.locator('#run').click();
  for (const {prompt, answer} of synonmTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect(promptLabel).toHaveText(prompt || 'Program input');
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(synonmBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(synonmBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
