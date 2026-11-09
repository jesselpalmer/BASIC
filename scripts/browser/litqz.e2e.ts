import {expect, test} from '@playwright/test';
import {assertLitqzOutput, litqzRounds, litqzSource} from '../litqz-acceptance.ts';

test('LITQZ finishes all three archived outcomes and starts each run fresh', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('litqz');
  await expect(page.locator('#document-dialect')).toHaveText('Dialect: edusystem-30');
  await expect(page.locator('#source')).toHaveValue(litqzSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  const run = page.locator('#run');
  const prompts = ['4)GUIPETTO?', "4)STROMBOLI'S?", '4)TOTO?', '4)WENDY?'];

  await run.click();
  await expect(status).toHaveText('Waiting for input');
  await page.locator('#stop').click();
  await expect(status).toHaveText('Stopped');

  for (const round of litqzRounds) {
    await run.click();
    for (const [index, answer] of round.answers.entries()) {
      await expect
        .poll(async () => (await output.textContent())?.endsWith(prompts[index]))
        .toBe(true);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    assertLitqzOutput((await output.textContent())!.replace(/\?[1-4]\n/g, '?'), round);
  }
});
