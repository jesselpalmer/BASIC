import {expect, test} from '@playwright/test';
import {assertNumberOutput, numberGames, numberPrompt, numberSource} from '../number-acceptance.ts';

test('NUMBER matches both archived wins, including halving and an out-of-range guess', async ({
  page,
}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('number');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(numberSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const run = page.locator('#run');
  for (const game of numberGames) {
    await run.click();
    for (const [index, answer] of game.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.split(numberPrompt).length)
        .toBe(index + 2);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    assertNumberOutput((await output.textContent())!.replace(/\?[1-6]\n/g, '?'), game);
  }
});
