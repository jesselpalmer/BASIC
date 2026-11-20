import {expect, test} from '@playwright/test';
import {
  checkrOptions,
  checkrSource,
  checkrAnswers,
  checkrTerminalTranscript,
  checkrBrowserOpening,
  checkrBrowserTranscript,
} from '../checkr-acceptance.ts';

test('reviewed CHECKR matches archived captures, kinging, retries and complete win', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('checkr');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${checkrOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(checkrSource);
  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const chunks = checkrTerminalTranscript.split('? ');
  await page.locator('#run').click();
  let paper = '';
  for (const [index, answer] of checkrAnswers.entries()) {
    paper += chunks[index];
    await expect(status).toHaveText('Waiting for input');
    await expect.poll(() => output.textContent()).toBe(paper);
    await input.fill(answer);
    await input.press('Enter');
    paper += answer + '\n';
  }
  await expect(status).toHaveText('Finished');
  await expect.poll(() => output.textContent()).toBe(checkrBrowserTranscript);
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(checkrBrowserOpening);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
