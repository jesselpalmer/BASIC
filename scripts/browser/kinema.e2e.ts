import {expect, test} from '@playwright/test';
import {assertKinemaOutput, kinemaPrompt, kinemaRuns, kinemaSource} from '../kinema-acceptance.ts';

test('KINEMA grades all answer bands and repeats with a fresh score', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('kinema');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(kinemaSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of kinemaRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect
      .poll(async () => (await output.textContent())?.split('?').length)
      .toBe(run.answers.length + 2);
    await expect(status).toHaveText('Waiting for input');
    const transcript = (await output.textContent())!.replace(/\?-?\d+(?:\.\d+)?\n/g, '?');
    expect(transcript.endsWith(kinemaPrompt)).toBe(true);
    assertKinemaOutput(transcript, run);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});
