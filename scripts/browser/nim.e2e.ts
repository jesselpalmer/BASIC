import {expect, test} from '@playwright/test';
import {nimOptions, nimRuns, nimSource} from '../nim-acceptance.ts';

test('NIM matches archived retries, both outcomes, replay and a fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('nim');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${nimOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(nimSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of nimRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    let offset = 0;
    let paper = '';
    for (const answer of run.answers) {
      const promptEnd = run.output.indexOf('?', offset) + 1;
      expect(promptEnd).toBeGreaterThan(offset);
      paper += run.output.slice(offset, promptEnd);
      offset = promptEnd;
      await expect(status).toHaveText('Waiting for input');
      await expect.poll(() => output.textContent()).toBe(paper);
      await input.fill(answer);
      await input.press('Enter');
      paper += answer + (/^[YN]$/.test(answer) ? '' : '\n');
    }
    await expect(status).toHaveText('Finished');
    await expect.poll(() => output.textContent()).toBe(paper + run.output.slice(offset));
  }
});
