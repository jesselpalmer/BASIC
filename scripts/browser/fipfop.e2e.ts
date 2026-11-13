import {expect, test} from '@playwright/test';
import {
  fipfopBrowserOpening,
  fipfopBrowserTranscript,
  fipfopOptions,
  fipfopSource,
  fipfopTurns,
} from '../fipfop-acceptance.ts';

test('FIPFOP matches archived retries, boards, replay, exit and fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('fipfop');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${fipfopOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(fipfopSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');

  await page.locator('#run').click();
  for (const {precedingOutput, answer} of fipfopTurns) {
    await expect(status).toHaveText('Waiting for input');
    await expect
      .poll(async () => (await output.textContent())?.endsWith(precedingOutput))
      .toBe(true);
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(fipfopBrowserTranscript);

  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(fipfopBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
