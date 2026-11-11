import {expect, test} from '@playwright/test';
import {assertStarsOutput, starsEntropy, starsRounds, starsSource} from '../stars-acceptance.ts';

test('STARS matches the archived hints, loss, replay win and fresh run', async ({page}) => {
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, starsEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('stars');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(starsSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const waitForPrompt = async (count: number) => {
    await expect.poll(async () => (await output.textContent())?.split('?').length).toBe(count + 1);
    await expect(status).toHaveText('Waiting for input');
  };
  for (const round of starsRounds) {
    await page.locator('#run').click();
    for (const [index, answer] of round.answers.entries()) {
      await waitForPrompt(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await waitForPrompt(round.answers.length + 1);
    assertStarsOutput((await output.textContent())!.replace(/\?\d+\n/g, '?'), round);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});
