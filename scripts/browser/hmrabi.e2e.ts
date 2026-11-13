import {expect, test} from '@playwright/test';
import {hmrabiOptions, hmrabiRuns, hmrabiSource} from '../hmrabi-acceptance.ts';

test('HMRABI matches the archived full term and impeachment on a fresh run', async ({page}) => {
  test.slow();
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('hmrabi');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${hmrabiOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(hmrabiSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of hmrabiRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    let offset = 0;
    let paper = '';
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      const prompt = run.prompts[index];
      const start = run.output.indexOf(prompt, offset);
      expect(start).toBeGreaterThanOrEqual(offset);
      const end = start + prompt.length;
      paper += run.output.slice(offset, end);
      offset = end;
      await expect.poll(() => output.textContent()).toBe(paper);
      await input.fill(answer);
      await input.press('Enter');
      paper += answer + '\n';
    }
    await expect(status).toHaveText('Finished');
    await expect.poll(() => output.textContent()).toBe(paper + run.output.slice(offset));
  }
});
