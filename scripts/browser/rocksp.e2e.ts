import {expect, test} from '@playwright/test';
import {assertRockspOutput, rockspRuns, rockspSource} from '../rocksp-acceptance.ts';

test('ROCKSP matches the ten-round sample reconstruction and a fresh run', async ({page}) => {
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, rockspRuns[0].clockWord / 4096);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('rocksp');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(rockspSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of rockspRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split('?').length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    assertRockspOutput((await output.textContent())!.replace(/\?\d+\n/g, '?'), run);
  }
});
