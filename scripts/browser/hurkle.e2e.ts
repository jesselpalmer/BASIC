import {expect, test} from '@playwright/test';
import {
  assertHurkleOutput,
  hurkleEntropy,
  hurklePrompt,
  hurkleRounds,
  hurkleSource,
} from '../hurkle-acceptance.ts';

test('HURKLE matches archived directions, wins, loss, replay and fresh run', async ({page}) => {
  await page.addInitScript((entropy) => {
    Math.random = () => entropy;
  }, hurkleEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('hurkle');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(hurkleSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const waitForPrompt = async (count: number) => {
    await expect.poll(async () => (await output.textContent())?.split('?').length).toBe(count + 1);
    await expect(status).toHaveText('Waiting for input');
  };
  for (const round of hurkleRounds) {
    await page.locator('#run').click();
    for (const [index, answer] of round.answers.entries()) {
      await waitForPrompt(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await waitForPrompt(round.answers.length + 1);
    const transcript = (await output.textContent())!.replace(/\?\d+,\d+\n/g, '?');
    expect(transcript.endsWith(hurklePrompt)).toBe(true);
    assertHurkleOutput(transcript, round);
    await page.locator('#stop').click();
    await expect(status).toHaveText('Stopped');
  }
});
