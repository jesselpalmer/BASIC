import {expect, test} from '@playwright/test';
import {assertHiLoOutput, hiLoOptions, hiLoRuns, hiLoSource} from '../hi-lo-acceptance.ts';

test('HI-LO matches archived jackpot wins, six misses, replay and a fresh RUN', async ({page}) => {
  await page.goto('/');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.locator('#example').selectOption('hi-lo');
  await expect(page.locator('#document-dialect')).toHaveText(`Dialect: ${hiLoOptions.dialect}`);
  await expect(page.locator('#source')).toHaveValue(hiLoSource);

  const status = page.locator('#status');
  const output = page.locator('#console-output');
  const input = page.locator('#input-value');
  for (const run of hiLoRuns) {
    await page.evaluate((entropy) => {
      Math.random = () => entropy;
    }, run.clockWord / 4096);
    await page.locator('#run').click();
    for (const [index, answer] of run.answers.entries()) {
      await expect(status).toHaveText('Waiting for input');
      await expect
        .poll(
          async () =>
            (await output.textContent())?.match(/YOUR GUESS\?|PLAY AGAIN \(Y OR N\)\?/g)?.length,
        )
        .toBe(index + 1);
      await input.fill(answer);
      await input.press('Enter');
    }
    await expect(status).toHaveText('Finished');
    const transcript = (await output.textContent())!
      .replace(/(YOUR GUESS\?)\d+\n/g, '$1')
      .replace(/(PLAY AGAIN \(Y OR N\)\?)[YN]/g, '$1');
    assertHiLoOutput(transcript, run);
  }
});
