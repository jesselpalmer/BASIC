import {expect, test} from '@playwright/test';
import {
  assertMathdOutput,
  mathdAnswers,
  mathdEntropy,
  mathdPrompt,
  mathdSource,
} from '../mathd-acceptance.ts';

test('MATHD matches the archived dice, retries and answer reveal', async ({page}) => {
  await page.addInitScript((entropy) => {
    let index = 0;
    Math.random = () => entropy[index++ % entropy.length];
  }, mathdEntropy);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('mathd');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(mathdSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const run = page.locator('#run');
  const waitForPrompt = async (count: number) => {
    await expect
      .poll(async () => (await output.textContent())?.split(mathdPrompt).length)
      .toBe(count + 1);
    await expect(status).toHaveText('Waiting for input');
  };
  await run.click();
  for (const [index, answer] of mathdAnswers.entries()) {
    await waitForPrompt(index + 1);
    await input.fill(answer);
    await input.press('Enter');
  }
  await waitForPrompt(mathdAnswers.length + 1);
  assertMathdOutput((await output.textContent())!.replace(/\?[07]\n/g, '?'));

  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
  await run.click();
  await waitForPrompt(1);
  await input.fill('7');
  await input.press('Enter');
  await waitForPrompt(2);
  await expect(output).toContainText('RIGHT!');
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');
});
