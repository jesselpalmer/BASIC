import {expect, test} from '@playwright/test';
import {rusrouOptions, rusrouRuns, rusrouSource} from '../rusrou-acceptance.ts';

test('RUSROU matches archived survival, loss, giving up and fresh runs', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('rusrou');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${rusrouOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(rusrouSource);
  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of rusrouRuns) {
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
      paper += answer + '\n';
    }
    await expect(status).toHaveText('Waiting for input');
    await expect.poll(() => output.textContent()).toBe(paper + run.output.slice(offset));
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
    await expect(page.locator('#source')).toHaveValue(rusrouSource);
  }
});
