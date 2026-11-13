import {expect, test} from '@playwright/test';
import {assertCrapsOutput, crapsOptions, crapsRuns, crapsSource} from '../craps-acceptance.ts';

test('CRAPS matches archived wagers, shooter changes, quit and bankruptcy', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('craps');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${crapsOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(crapsSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of crapsRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(/HOW MUCH DO YOU BET\?|ARE YOU READY \(Y OR N\)\?/g)
              ?.length,
        )
        .toBe(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/(HOW MUCH DO YOU BET\?)(?:\d+|\.5)\n/g, '$1')
      .replace(/(ARE YOU READY \(Y OR N\)\? )[YN]/g, '$1');
    assertCrapsOutput(transcript, run);
  }
});
