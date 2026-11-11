import {expect, test} from '@playwright/test';
import {assertRocketOutput, rocketPrompt, rocketRuns, rocketSource} from '../rocket-acceptance.ts';

test('ROCKET reproduces the printed landing, crash, and fresh start', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('rocket');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(rocketSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of rocketRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    // A completed attempt prints TRY AGAIN?? and requests the first new burn.
    await expect
      .poll(async () => (await output.textContent())?.split('?').length)
      .toBe(run.answers.length + 4);
    await expect(status).toHaveText('Waiting for input');
    const transcript = (await output.textContent())!.replace(/\?\d+(?:\.\d+)?\n/g, '?');
    expect(transcript.endsWith(rocketPrompt)).toBe(true);
    assertRocketOutput(transcript, run);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});
