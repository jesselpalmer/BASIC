import {expect, test} from '@playwright/test';
import {
  nicomaAnswers,
  nicomaFirstPrompt,
  nicomaOptions,
  nicomaOutput,
  nicomaSource,
  nicomaThinking,
} from '../nicoma-acceptance.ts';

test('NICOMA replays four archived rounds, stops and runs fresh', async ({page}) => {
  test.setTimeout(35_000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('nicoma');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${nicomaOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(nicomaSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  await page.locator('#run').click();
  for (const answer of nicomaAnswers) {
    await expect(status).toHaveText('Waiting for input', {timeout: 7000});
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Waiting for input');
  await expect.poll(() => output.textContent()).toBe(nicomaOutput.browser);
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');

  await page.locator('#run').click();
  for (const answer of nicomaAnswers.slice(0, 3)) {
    await expect(status).toHaveText('Waiting for input');
    await input.fill(answer);
    await input.press('Enter');
  }
  await expect(status).toHaveText('Running');
  await expect
    .poll(() => output.textContent())
    .toBe(
      nicomaOutput.browser.slice(
        0,
        nicomaOutput.browser.indexOf(nicomaThinking) + nicomaThinking.length,
      ),
    );
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await page.locator('#run').click();
  await expect(status).toHaveText('Waiting for input');
  await expect
    .poll(() => output.textContent())
    .toBe(
      nicomaOutput.browser.slice(
        0,
        nicomaOutput.browser.indexOf(nicomaFirstPrompt) + nicomaFirstPrompt.length,
      ),
    );
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
