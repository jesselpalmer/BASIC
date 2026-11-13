import {expect, test} from '@playwright/test';
import {assertBuzzwdOutput, buzzwdRuns, buzzwdSource} from '../buzzwd-acceptance.ts';

test('BUZZWD matches the printed phrases, three-field retries and fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('buzzwd');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(buzzwdSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of buzzwdRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.match(/(?<!')\?/g)?.length)
        .toBe(index + 1);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!.replace(/\?[-\w,]+\n/g, '?');
    assertBuzzwdOutput(transcript, run);
  }
});
