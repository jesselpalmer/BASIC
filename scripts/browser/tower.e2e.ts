import {expect, test} from '@playwright/test';
import {assertTowerOutput, towerOptions, towerRuns, towerSource} from '../tower-acceptance.ts';

test('TOWER plays the printed moves, MARK replay and fresh games', async ({page}) => {
  test.setTimeout(30000);
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('tower');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${towerOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(towerSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of towerRuns) {
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(
              /\?|TRY ANOTHER ONE \(Y OR N\)\n|'Y' OR 'N' PLEASE\n/g,
            )?.length,
        )
        .toBe(index + 1);
      await expect(status).toHaveText('Waiting for input');
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/\?\d+\n/g, '?')
      .replace(/(TRY ANOTHER ONE \(Y OR N\)\n|'Y' OR 'N' PLEASE\n)[NQY]/g, '$1');
    assertTowerOutput(transcript, run);
  }
});
